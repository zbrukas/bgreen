import type { AiCallObservation } from "@bgreen/ai";
import { composeObservers } from "@bgreen/ai";
import { describe, expect, it, vi } from "vitest";
import type { PostHogTelemetry } from "../../../telemetry/posthog.js";
import { createAiToolCallPostHogObserver } from "./posthog-observer.js";

function recordingTelemetry(): PostHogTelemetry & {
  events: Array<Parameters<PostHogTelemetry["capture"]>[0]>;
} {
  const events: Array<Parameters<PostHogTelemetry["capture"]>[0]> = [];
  return {
    events,
    capture: (input) => {
      events.push(input);
    },
    shutdown: () => Promise.resolve(),
  };
}

function happyObservation(): AiCallObservation {
  return {
    toolName: "extract_economic_profile",
    outcome: "ok",
    latencyMs: 850,
    usage: {
      inputTokens: 2000,
      outputTokens: 200,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 1500,
    },
    context: {
      organizationId: "org-1",
      actorUserId: "user-1",
      correlationId: "log-1",
      metadata: { feature: "ies_extraction" },
    },
  };
}

describe("createAiToolCallPostHogObserver", () => {
  it("captures ai.tool_call with token usage + approximate cost on success", async () => {
    const telemetry = recordingTelemetry();
    const observer = createAiToolCallPostHogObserver(telemetry);
    await observer(happyObservation());

    expect(telemetry.events).toHaveLength(1);
    const event = telemetry.events[0];
    if (!event) throw new Error("missing event");
    expect(event.event).toBe("ai.tool_call");
    expect(event.distinctId).toBe("user-1");
    expect(event.groups).toEqual({ company: "org-1" });
    expect(event.properties?.tool_name).toBe("extract_economic_profile");
    expect(event.properties?.outcome).toBe("ok");
    expect(event.properties?.latency_ms).toBe(850);
    expect(event.properties?.input_tokens).toBe(2000);
    expect(event.properties?.output_tokens).toBe(200);
    expect(event.properties?.cache_read_input_tokens).toBe(1500);
    expect(event.properties?.feature).toBe("ies_extraction");
    // Sonnet 4.6 default: input $3/M, output $15/M, cache reads ~0.1×.
    // 2000 × 3/1e6 + 200 × 15/1e6 + 1500 × 3 × 0.1/1e6
    //   = 0.006 + 0.003 + 0.00045 = 0.00945
    expect(event.properties?.approximate_cost_usd).toBeCloseTo(0.00945, 5);
  });

  it("captures error_kind when outcome is 'error'", async () => {
    const telemetry = recordingTelemetry();
    const observer = createAiToolCallPostHogObserver(telemetry);
    await observer({
      toolName: "classify_document",
      outcome: "error",
      errorKind: "transient",
      latencyMs: 200,
      usage: null,
      context: { organizationId: "org-1", correlationId: "log-2" },
    });
    const event = telemetry.events[0];
    if (!event) throw new Error("missing event");
    expect(event.properties?.outcome).toBe("error");
    expect(event.properties?.error_kind).toBe("transient");
    // No usage → no cost.
    expect(event.properties?.approximate_cost_usd).toBeNull();
  });

  it("falls back to org-scoped distinctId when no actor (system-initiated call)", async () => {
    const telemetry = recordingTelemetry();
    const observer = createAiToolCallPostHogObserver(telemetry);
    await observer({
      toolName: "extract_economic_profile",
      outcome: "ok",
      latencyMs: 100,
      usage: null,
      context: { organizationId: "org-9", actorUserId: null, correlationId: "log-3" },
    });
    expect(telemetry.events[0]?.distinctId).toBe("org:org-9");
  });
});

describe("composeObservers", () => {
  it("fans out to every observer with the same observation", async () => {
    const callsA: AiCallObservation[] = [];
    const callsB: AiCallObservation[] = [];
    const composed = composeObservers([
      (o) => {
        callsA.push(o);
      },
      (o) => {
        callsB.push(o);
      },
    ]);
    const obs = happyObservation();
    await composed(obs);
    expect(callsA).toHaveLength(1);
    expect(callsB).toHaveLength(1);
    expect(callsA[0]).toBe(obs);
    expect(callsB[0]).toBe(obs);
  });

  it("isolates failures — one observer throwing does not skip the others", async () => {
    const succeeded = vi.fn();
    const composed = composeObservers([
      () => {
        throw new Error("audit DB down");
      },
      succeeded,
    ]);
    await composed(happyObservation());
    expect(succeeded).toHaveBeenCalledOnce();
  });
});
