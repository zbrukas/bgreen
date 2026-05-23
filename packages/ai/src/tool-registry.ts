// A tool definition is the entire contract between bGreen and the model for
// one structured extraction call: what input we accept from callers, what
// system + user prompt we render, and what shape we demand back.
//
// The model never freeform-replies — `AnthropicAiClient.call` uses `tool_choice`
// to force the registered tool, so the response is always a tool_use block
// whose `input` field we validate against `outputSchema`.

import type Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface AiToolDefinition<TInput, TOutput> {
  // Stable, snake_case identifier the model sees. Don't rename without
  // invalidating the prompt cache and re-running any eval suite.
  name: string;
  // Brief description shown to the model. Tells it when the tool is the
  // right choice (less critical here because we always force the tool).
  description: string;
  // Validates the data the caller hands to `client.call(tool, input)`.
  inputSchema: ZodSchema<TInput>;
  // Becomes the Anthropic tool's `input_schema` (JSON Schema). The model is
  // forced to respond with a tool_use block matching this shape.
  outputSchema: ZodSchema<TOutput>;
  // Tool-specific system prompt. Prepended with the global pt-PT prefix
  // (see system-prompt.ts) at call time.
  systemPrompt: string;
  // Renders the user message Claude actually sees, given the validated input.
  // Returning content blocks (not a string) leaves room for PDF/image attachments
  // in later verticals.
  buildUserMessage: (input: TInput) => Anthropic.ContentBlockParam[];
  // Per-tool output cap. IES extraction returns small structured JSON, so the
  // default works; tools producing longer outputs (eventual report commentary)
  // override.
  maxTokens?: number;
}

// Type-erased view used internally by the client. The client doesn't care
// about TInput/TOutput once it has validated against the schemas — collapsing
// to `unknown` keeps the call site free of generic juggling.
export type AnyAiToolDefinition = AiToolDefinition<unknown, unknown>;

// Identity helper. Exists purely for inference — `defineAiTool({...})` infers
// TInput and TOutput from the provided zod schemas, so callers don't have to
// type-annotate.
export const defineAiTool = <TInput, TOutput>(
  def: AiToolDefinition<TInput, TOutput>,
): AiToolDefinition<TInput, TOutput> => def;

// Convert one of our tool definitions into the Anthropic SDK's `Tool` shape.
// The outputSchema becomes the model's input_schema (because what the model
// "inputs" to the tool IS our structured output).
export function toAnthropicTool(def: AnyAiToolDefinition): Anthropic.Tool {
  // zod-to-json-schema may emit an outer `$ref` + `$defs` wrapper for some
  // schema shapes. Anthropic's tool input_schema expects a plain object
  // schema at the top level, so request the inline form.
  const jsonSchema = zodToJsonSchema(def.outputSchema, {
    target: "openApi3",
    $refStrategy: "none",
  }) as Record<string, unknown>;

  // Anthropic requires `type: "object"` at the top of input_schema. zod-to-
  // json-schema produces that for ZodObject; for other schema kinds the
  // caller has built the wrong outputSchema.
  if (jsonSchema.type !== "object") {
    throw new Error(
      `Tool '${def.name}': outputSchema must be a zod object schema (got type=${String(jsonSchema.type)}).`,
    );
  }

  return {
    name: def.name,
    description: def.description,
    input_schema: jsonSchema as Anthropic.Tool["input_schema"],
  };
}
