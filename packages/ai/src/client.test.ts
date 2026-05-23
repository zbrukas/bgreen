import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AnthropicAiClient, type MessagesClient } from "./client";
import { PT_PT_SYSTEM_PREFIX } from "./system-prompt";
import { defineAiTool } from "./tool-registry";

// A representative tool for the test suite. Mirrors the shape V6.3's
// extractEconomicProfile will use: text in, structured JSON out.
const extractTool = defineAiTool({
  name: "extract_profile",
  description: "Extract the company size from an IES text.",
  inputSchema: z.object({ documentText: z.string().min(1) }),
  outputSchema: z.object({
    employees: z.number().int().min(0),
    turnover: z.number().min(0),
  }),
  systemPrompt: "Extrai os campos económicos do IES fornecido.",
  buildUserMessage: (input) => [{ type: "text", text: input.documentText }],
});

function fakeToolUseResponse(input: unknown): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      server_tool_use: null,
      service_tier: null,
    } as Anthropic.Usage,
    content: [
      {
        type: "tool_use",
        id: "toolu_test",
        name: "extract_profile",
        input,
      },
    ],
  } as Anthropic.Message;
}

function fakeTextOnlyResponse(stopReason: Anthropic.StopReason = "end_turn"): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      server_tool_use: null,
      service_tier: null,
    } as Anthropic.Usage,
    content: [{ type: "text", text: "I cannot help with that.", citations: null }],
  } as Anthropic.Message;
}

function stubMessages(create: MessagesClient["create"]): MessagesClient {
  return { create };
}

describe("AnthropicAiClient.call", () => {
  it("happy path — validates output and returns ok", async () => {
    const messages = stubMessages(
      vi.fn(async () => fakeToolUseResponse({ employees: 42, turnover: 1_500_000 })),
    );
    const client = new AnthropicAiClient({ messages });
    const result = await client.call(extractTool, { documentText: "IES 2024..." });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ employees: 42, turnover: 1_500_000 });
    }
  });

  it("rejects input that fails inputSchema before hitting the SDK", async () => {
    const create = vi.fn();
    const client = new AnthropicAiClient({ messages: stubMessages(create) });
    // documentText must be non-empty per the tool's inputSchema.
    const result = await client.call(extractTool, { documentText: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("input_validation");
    }
    expect(create).not.toHaveBeenCalled();
  });

  it("forces tool_choice to the registered tool name", async () => {
    let sent: Anthropic.MessageCreateParamsNonStreaming | null = null;
    const client = new AnthropicAiClient({
      messages: {
        create: async (params) => {
          sent = params;
          return fakeToolUseResponse({ employees: 1, turnover: 100 });
        },
      },
    });
    await client.call(extractTool, { documentText: "..." });
    expect(sent).not.toBeNull();
    const params = sent as unknown as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.tool_choice).toEqual({ type: "tool", name: "extract_profile" });
    expect(params.tools).toHaveLength(1);
    const sentTool = params.tools?.[0] as Anthropic.Tool;
    expect(sentTool.name).toBe("extract_profile");
    expect(sentTool.cache_control).toEqual({ type: "ephemeral" });
  });

  it("prepends the pt-PT system prefix to the tool's system prompt", async () => {
    let sent: Anthropic.MessageCreateParamsNonStreaming | null = null;
    const client = new AnthropicAiClient({
      messages: {
        create: async (params) => {
          sent = params;
          return fakeToolUseResponse({ employees: 1, turnover: 100 });
        },
      },
    });
    await client.call(extractTool, { documentText: "..." });
    expect(sent).not.toBeNull();
    const params = sent as unknown as Anthropic.MessageCreateParamsNonStreaming;
    const system = params.system as Anthropic.TextBlockParam[];
    expect(system).toHaveLength(1);
    expect(system[0]?.text).toContain(PT_PT_SYSTEM_PREFIX);
    expect(system[0]?.text).toContain("Extrai os campos económicos");
    expect(system[0]?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("returns no_tool_use when the model declines to invoke the tool", async () => {
    const messages = stubMessages(vi.fn(async () => fakeTextOnlyResponse("refusal")));
    const client = new AnthropicAiClient({ messages });
    const result = await client.call(extractTool, { documentText: "..." });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("no_tool_use");
      expect(result.error.message).toContain("refusal");
    }
  });

  it("returns output_parse when the tool_use input fails outputSchema", async () => {
    // employees: -3 violates `.int().min(0)` on the outputSchema.
    const messages = stubMessages(
      vi.fn(async () => fakeToolUseResponse({ employees: -3, turnover: 100 })),
    );
    const client = new AnthropicAiClient({ messages });
    const result = await client.call(extractTool, { documentText: "..." });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("output_parse");
    }
  });

  it("maps SDK RateLimitError to transient", async () => {
    const sdkError = new Anthropic.RateLimitError(429, undefined, "rate limited", new Headers());
    const messages = stubMessages(
      vi.fn(async () => {
        throw sdkError;
      }),
    );
    const client = new AnthropicAiClient({ messages });
    const result = await client.call(extractTool, { documentText: "..." });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("transient");
      expect(result.error.cause).toBe(sdkError);
    }
  });

  it("maps SDK BadRequestError to client", async () => {
    const sdkError = new Anthropic.BadRequestError(400, undefined, "bad", new Headers());
    const messages = stubMessages(
      vi.fn(async () => {
        throw sdkError;
      }),
    );
    const client = new AnthropicAiClient({ messages });
    const result = await client.call(extractTool, { documentText: "..." });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("client");
    }
  });

  it("maps SDK AuthenticationError to auth", async () => {
    const sdkError = new Anthropic.AuthenticationError(401, undefined, "no key", new Headers());
    const messages = stubMessages(
      vi.fn(async () => {
        throw sdkError;
      }),
    );
    const client = new AnthropicAiClient({ messages });
    const result = await client.call(extractTool, { documentText: "..." });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth");
    }
  });
});
