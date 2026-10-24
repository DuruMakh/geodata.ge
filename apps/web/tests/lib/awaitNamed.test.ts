import { describe, expect, it } from "vitest";
import { awaitNamed } from "../../lib/awaitNamed";

describe("awaitNamed", () => {
  it("resolves each name to its own promise's value", async () => {
    // The slower promise first: names, not completion order, decide where a value lands.
    const slow = new Promise<number>(resolve => setTimeout(() => resolve(1), 20));
    await expect(awaitNamed({ a: slow, b: Promise.resolve("x") })).resolves.toEqual({ a: 1, b: "x" });
  });

  it("rejects when any promise rejects", async () => {
    await expect(awaitNamed({ a: Promise.resolve(1), b: Promise.reject(new Error("boom")) })).rejects.toThrow("boom");
  });
});
