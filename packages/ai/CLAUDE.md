# packages/ai — AnthropicAiClient + tool registry

Bounded context: all Claude API interactions.

## Owns (from V6 onward)
- `AnthropicAiClient` — typed facade over `@anthropic-ai/sdk`.
- Tool registrations (zod → Anthropic tool definitions).
- Prompt caching for system + tool definitions.
- Retry + error mapping.
- pt-PT system-prompt prefix enforcement.
- Bedrock EU adapter (scaffolded, disabled).

## Does NOT own
- Tool implementations that compose with other modules — those live in `apps/api/src/modules/<name>/application/`.
- Token cost accounting (callers write metrics; this package is the transport).

## Rule
- The Anthropic API key only exists in this package and only at runtime in `apps/api`.
- All callers receive `Result<T, AiError>` — exceptions never escape this package.
