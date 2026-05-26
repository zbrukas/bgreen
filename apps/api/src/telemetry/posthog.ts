// PostHogTelemetry — thin facade over posthog-node.
//
// PRD §AI plumbing names PostHogTelemetry as a deep module. For v1 it
// lives in apps/api; promote to packages/telemetry when a second app
// (apps/cs, apps/pdf) needs it.
//
// Two variants:
//   - Active: real posthog-node client. Used in prod (and locally when
//     POSTHOG_API_KEY is set).
//   - NoOp: silent stand-in. Boot doesn't break when the key is missing;
//     dev runs without sending events; tests inject this directly.
//
// Both expose the same interface so callers don't branch on whether
// telemetry is "really on".

import { PostHog } from "posthog-node";

export interface PostHogTelemetry {
  capture(input: {
    event: string;
    distinctId: string;
    properties?: Record<string, unknown>;
    groups?: Record<string, string>;
  }): void;
  shutdown(): Promise<void>;
}

export class ActivePostHogTelemetry implements PostHogTelemetry {
  private readonly client: PostHog;

  constructor(apiKey: string, options: { host?: string } = {}) {
    this.client = new PostHog(apiKey, {
      // EU instance by default — keeps telemetry in-region with the
      // rest of bGreen's data plane.
      host: options.host ?? "https://eu.i.posthog.com",
      // Flush small batches quickly so dev events show up in the
      // dashboard without the user waiting for a 10s timer.
      flushAt: 10,
      flushInterval: 2000,
    });
  }

  capture(input: Parameters<PostHogTelemetry["capture"]>[0]): void {
    this.client.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
      groups: input.groups,
    });
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}

export class NoOpPostHogTelemetry implements PostHogTelemetry {
  capture(): void {
    // intentionally empty
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

// Boot helper. Picks the right impl based on env. Process-wide
// singleton; the SIGTERM handler ensures pending events flush before
// the container goes away.
export function buildPostHogTelemetry(): PostHogTelemetry {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey || apiKey.trim() === "") return new NoOpPostHogTelemetry();
  const telemetry = new ActivePostHogTelemetry(apiKey, {
    host: process.env.POSTHOG_HOST,
  });
  // Best-effort flush on graceful shutdown. We register on SIGTERM
  // (process supervisors + Docker send this) and SIGINT (Ctrl-C in dev).
  const onExit = (): void => {
    void telemetry.shutdown();
  };
  process.once("SIGTERM", onExit);
  process.once("SIGINT", onExit);
  return telemetry;
}
