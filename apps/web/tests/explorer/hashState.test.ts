import { describe, expect, it } from "vitest";
import { writeHash } from "../../components/explorer-shell/use-hash-state";

function fakeWindow(hash: string, failing = false) {
  const calls: Array<[string, string]> = [];
  const record = (kind: string) => (_state: unknown, _title: string, url?: string | URL | null) => {
    if (failing) throw new Error("History denied");
    calls.push([kind, String(url)]);
  };
  const target = {
    location: { hash } as Location,
    history: { pushState: record("push"), replaceState: record("replace") } as unknown as History,
  };
  return { target, calls };
}

describe("writeHash", () => {
  it("pushes a history entry in push mode", () => {
    const { target, calls } = fakeWindow("#old");
    writeHash("#a", "push", target);
    expect(calls).toEqual([["push", "#a"]]);
  });

  it("replaces the current entry in replace mode", () => {
    const { target, calls } = fakeWindow("#old");
    writeHash("#a", "replace", target);
    expect(calls).toEqual([["replace", "#a"]]);
  });

  it("writes nothing when the hash is already current", () => {
    const { target, calls } = fakeWindow("#a");
    writeHash("#a", "push", target);
    expect(calls).toEqual([]);
  });

  it("does not throw when History access is denied", () => {
    const { target } = fakeWindow("#old", true);
    expect(() => writeHash("#a", "push", target)).not.toThrow();
  });
});
