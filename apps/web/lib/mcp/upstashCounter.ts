import { randomUUID } from "node:crypto";
import type { Counter } from "./limits";

// One atomic command per limit check. A rolling window (the minute bucket) is
// a sorted set; a fixed window (each daily key, per client and shared, already
// includes its UTC date) stores only an integer, given its expiry once, when
// the first hit creates it.
// Redis time keeps different function instances on the same clock.
const HIT = `
local key = KEYS[1]
local seconds = tonumber(ARGV[1])
local maximum = tonumber(ARGV[2])
if ARGV[4] == 'fixed' then
  if tonumber(redis.call('GET', key) or '0') >= maximum then return 0 end
  if redis.call('INCR', key) == 1 then redis.call('EXPIRE', key, seconds) end
else
  local time = redis.call('TIME')
  local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - seconds * 1000)
  if redis.call('ZCARD', key) >= maximum then return 0 end
  redis.call('ZADD', key, now, ARGV[3])
  redis.call('EXPIRE', key, seconds)
end
return 1
`;

export function upstashCounter(): Counter {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const namespace = process.env.VERCEL_ENV === "production" ? "production" : "preview";
  let configured = false;
  try {
    const endpoint = new URL(url ?? "");
    configured = endpoint.protocol === "https:" && endpoint.hostname.endsWith(".upstash.io") && !!token && !endpoint.username && !endpoint.password;
  } catch { /* Missing or malformed configuration fails closed. */ }

  return {
    async hit(key, windowSeconds, maximum, window = "rolling") {
      if (!configured) return "unavailable";
      try {
        const response = await fetch(url!, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(["EVAL", HIT, 1, `${namespace}:${key}`, windowSeconds, maximum, randomUUID(), window]),
          cache: "no-store",
          signal: AbortSignal.timeout(1500),
        });
        if (!response.ok) return "unavailable";
        const body: { result?: unknown } = await response.json();
        return body.result === 1 ? "allow" : body.result === 0 ? "deny" : "unavailable";
      } catch {
        // Never retain provider errors: they can contain URLs or credentials.
        return "unavailable";
      }
    },
  };
}
