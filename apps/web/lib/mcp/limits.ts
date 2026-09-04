// apps/web/lib/mcp/limits.ts
//
// The pause switch and the shared request counter (spec section 11.3). The
// size limits themselves live with the code that applies them, in result.ts;
// they are re-exported here so callers have one import.
export { LIMITS } from "./result";
import { upstashCounter } from "./upstashCounter";

/** Requests per rolling window, per key. Spec 11.3: 60 in a rolling minute. */
export const RATE_WINDOW_SECONDS = 60;
export const RATE_MAX_REQUESTS = 60;

/**
 * Is /mcp switched off?
 *
 * Default OFF, and only the exact string "true" turns it on. Spec 18 makes both
 * unapproved paid services and per-process-only abuse protection stop
 * conditions, so the endpoint ships deployed and dark: enabling it is the
 * owner's authorised step once hosting, limiter and operating budget are on
 * record (section 11.4).
 *
 * This is one variable on one route. Pausing /mcp does not touch the static
 * pages, the CSV downloads, or the published JSON files - which is exactly what
 * 11.3's "pause control" row requires.
 */
export function isPaused(): boolean {
  return process.env.MCP_ENABLED !== "true";
}

export type CounterVerdict = "allow" | "deny" | "unavailable";

export type Counter = {
  hit(key: string, windowSeconds: number, max: number): Promise<CounterVerdict>;
};

/**
 * Process-local counter. **Development and tests only.**
 *
 * Spec 18 names per-process-only abuse protection as a stop condition for the
 * runtime, and it means it: serverless instances scale horizontally, so a
 * process-local count of 60 becomes 60 x N in production and enforces nothing.
 * It exists so the endpoint is exercisable locally, not so it can ship.
 */
export function memoryCounter(): Counter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    hit(key, windowSeconds, max) {
      const now = Date.now();
      const existing = windows.get(key);

      if (existing === undefined || existing.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        return Promise.resolve("allow");
      }
      if (existing.count >= max) return Promise.resolve("deny");

      existing.count += 1;
      return Promise.resolve("allow");
    },
  };
}

/** Fails closed. Serving unlimited public traffic is not a safe default. */
function unavailableCounter(): Counter {
  return { hit: () => Promise.resolve("unavailable") };
}

/**
 * The counter this deployment is configured to use.
 *
 * With nothing configured it fails closed rather than serving unlimited public
 * traffic, so /mcp cannot be enabled without a limiter decision having been
 * made. The approved shared counter is Upstash Redis on its free plan, with automatic
 * upgrades disabled. See docs/deployment.md for quotas and failure behavior.
 */
export function createCounter(): Counter {
  if (process.env.MCP_RATE_LIMITER === "upstash") return upstashCounter();
  // The in-process counter is refused in production outright, not merely
  // documented as unsafe there. A single mistyped environment variable on the
  // Production scope would otherwise turn a fail-closed endpoint into an
  // effectively unlimited one - which is the section 18 stop condition this
  // whole module exists to avoid - and nothing would report it.
  if (process.env.VERCEL_ENV === "production") return unavailableCounter();

  return process.env.MCP_RATE_LIMITER === "memory" ? memoryCounter() : unavailableCounter();
}
