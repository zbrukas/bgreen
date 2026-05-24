// AnthropicAiClient — typed facade over @anthropic-ai/sdk.
//
// Single entry point for every Claude call in bGreen: `call(tool, input, ctx?)`.
// Validates input → forces the registered tool via tool_choice → validates
// the model's tool_use input field against the tool's outputSchema → returns
// Result<TOutput, AiError>. No exceptions escape (see CLAUDE.md).
//
// Cross-cutting concerns this owns:
//   - pt-PT system-prompt prefix (every request)
//   - prompt caching on system + tool definitions
//   - retry with exponential backoff (delegated to the SDK's built-in retry)
//   - mapping SDK exceptions to AiError
//   - per-call observer hook for audit / telemetry
//
// What it does NOT own:
//   - Tool definitions — those live with the consuming module (e.g.,
//     IES extraction tools live in apps/api/src/modules/economic-profile).
//   - Audit storage or telemetry sinks — observers in apps/api do that.

import Anthropic from "@anthropic-ai/sdk";
import {
  type AiError,
  aiError,
  aiErrorFromSdkException,
  aiErrorFromZod,
} from "./errors";
import type {
  AiCallContext,
  AiCallObservation,
  AiCallObserver,
  AiTokenUsage,
} from "./observer";
import { type Result, err, ok } from "./result";
import { buildSystemBlocks } from "./system-prompt";
import {
  type AiToolDefinition,
  type AnyAiToolDefinition,
  toAnthropicTool,
} from "./tool-registry";

// PRD §AI plumbing: "Claude Sonnet 4.x via the official `@anthropic-ai/sdk`".
// Sonnet 4.6 hits the speed/intelligence balance the product wants;
// extraction doesn't need Opus.
const DEFAULT_MODEL: Anthropic.Model = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;
// SDK's internal retry handles 429/5xx/network with exponential backoff.
// Bump above the default (2) so transient Anthropic blips don't surface as
// failures during normal IES extraction.
const DEFAULT_MAX_RETRIES = 3;

// Minimal interface we actually use from the SDK's `messages` resource.
// Defining the shape ourselves lets unit tests inject a fake without
// constructing a full Anthropic client (and without trying to stub the
// resource on a real one, which the SDK marks readonly).
export interface MessagesClient {
  create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
}

// Interface a caller depends on — lets tests substitute a fake without
// constructing a full SDK. `AnthropicAiClient` implements this; future
// adapters (Bedrock EU) would too.
export interface AiClient {
  call<TInput, TOutput>(
    tool: AiToolDefinition<TInput, TOutput>,
    input: TInput,
    context?: AiCallContext,
  ): Promise<Result<TOutput, AiError>>;
}

export interface AnthropicAiClientOptions {
  // Reads from ANTHROPIC_API_KEY when omitted — the standard SDK behaviour.
  apiKey?: string;
  // Defaults to claude-sonnet-4-6 per the PRD. Override per-deployment if a
  // future tool needs Opus.
  model?: Anthropic.Model;
  maxRetries?: number;
  // Test seam — inject a fake messages client to avoid hitting the network.
  messages?: MessagesClient;
  // Called once per `call()` attempt with success/failure + tokens. Use
  // this in apps/api to write `ai.tool_call` audit rows.
  observer?: AiCallObserver;
}

export class AnthropicAiClient implements AiClient {
  private readonly messages: MessagesClient;
  private readonly model: Anthropic.Model;
  private readonly observer?: AiCallObserver;

  constructor(options: AnthropicAiClientOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.observer = options.observer;
    if (options.messages) {
      this.messages = options.messages;
    } else {
      const sdk = new Anthropic({
        apiKey: options.apiKey,
        maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      });
      // Narrow to the single overload we use. The SDK's `messages.create` is
      // overloaded for streaming/non-streaming; collapsing avoids forcing the
      // test fake to declare every signature.
      this.messages = {
        create: (params) => sdk.messages.create(params),
      };
    }
  }

  async call<TInput, TOutput>(
    tool: AiToolDefinition<TInput, TOutput>,
    input: TInput,
    context: AiCallContext = {},
  ): Promise<Result<TOutput, AiError>> {
    const inputParse = tool.inputSchema.safeParse(input);
    if (!inputParse.success) {
      const error = aiErrorFromZod(inputParse.error, "input_validation");
      await this.observe({
        toolName: tool.name,
        outcome: "error",
        errorKind: error.kind,
        latencyMs: 0,
        usage: null,
        context,
      });
      return err(error);
    }

    // Cast to the type-erased form for the request build — the generic
    // surface exists for callers, not for the request plumbing.
    const def = tool as unknown as AnyAiToolDefinition;

    let anthropicTool: Anthropic.Tool;
    try {
      anthropicTool = toAnthropicTool(def);
    } catch (e) {
      const error = aiError("client", e instanceof Error ? e.message : String(e), e);
      await this.observe({
        toolName: tool.name,
        outcome: "error",
        errorKind: error.kind,
        latencyMs: 0,
        usage: null,
        context,
      });
      return err(error);
    }

    // cache_control on the last tool extends caching across system + tools.
    const cachedTool: Anthropic.Tool = {
      ...anthropicTool,
      cache_control: { type: "ephemeral" },
    };

    const userContent = def.buildUserMessage(inputParse.data);

    const startedAt = Date.now();
    let response: Anthropic.Message;
    try {
      response = await this.messages.create({
        model: this.model,
        max_tokens: tool.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: buildSystemBlocks(tool.systemPrompt),
        tools: [cachedTool],
        // Force the tool — extraction must always produce structured output.
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: userContent }],
      });
    } catch (e) {
      const error = aiErrorFromSdkException(e);
      await this.observe({
        toolName: tool.name,
        outcome: "error",
        errorKind: error.kind,
        latencyMs: Date.now() - startedAt,
        usage: null,
        context,
      });
      return err(error);
    }
    const latencyMs = Date.now() - startedAt;
    const usage = extractUsage(response);

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      const error = aiError(
        "no_tool_use",
        `model returned stop_reason=${response.stop_reason} without invoking tool '${tool.name}'`,
        response,
      );
      await this.observe({
        toolName: tool.name,
        outcome: "error",
        errorKind: error.kind,
        latencyMs,
        usage,
        context,
      });
      return err(error);
    }

    const outputParse = tool.outputSchema.safeParse(toolUse.input);
    if (!outputParse.success) {
      const error = aiErrorFromZod(outputParse.error, "output_parse");
      await this.observe({
        toolName: tool.name,
        outcome: "error",
        errorKind: error.kind,
        latencyMs,
        usage,
        context,
      });
      return err(error);
    }

    await this.observe({
      toolName: tool.name,
      outcome: "ok",
      latencyMs,
      usage,
      context,
    });
    return ok(outputParse.data);
  }

  // Observer failures must not corrupt the AI call's outcome. We catch
  // and drop — observers themselves own their reliability (best effort).
  private async observe(observation: AiCallObservation): Promise<void> {
    if (!this.observer) return;
    try {
      await this.observer(observation);
    } catch {
      // Intentional swallow — see comment above.
    }
  }
}

function extractUsage(message: Anthropic.Message): AiTokenUsage {
  // SDK 0.98's Usage type fills these as numbers or null. Normalize to
  // `null` for missing fields rather than 0 — distinguishes "not reported"
  // from "actually zero".
  const u = message.usage;
  return {
    inputTokens: u.input_tokens ?? null,
    outputTokens: u.output_tokens ?? null,
    cacheCreationInputTokens: u.cache_creation_input_tokens ?? null,
    cacheReadInputTokens: u.cache_read_input_tokens ?? null,
  };
}
