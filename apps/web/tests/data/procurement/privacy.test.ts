import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { isPersonalNumber, loadOrCreateSecret, maskPersonalNumbers, partyKey, stripPersonalNumbers } from "../../../lib/data/procurement/privacy";

const SECRET = "a".repeat(64);

test("an 11-digit code is a personal number; a 9-digit company code is not", () => {
  expect(isPersonalNumber("01019067930")).toBe(true);
  expect(isPersonalNumber(" 01019067930 ")).toBe(true);
  expect(isPersonalNumber("202283242")).toBe(false);
  expect(isPersonalNumber("0101906793a")).toBe(false);
});

test("a personal number becomes a stable key that does not contain it", () => {
  const key = partyKey("01019067930", SECRET);
  expect(key).toBe(partyKey("01019067930", SECRET));
  expect(key).not.toBe(partyKey("01019067930", "b".repeat(64)));
  expect(key).toMatch(/^p_[0-9a-f]{16}$/);
  expect(key).not.toContain("01019067930");
});

test("a company code is kept as published", () => {
  expect(partyKey(" 202283242 ", SECRET)).toBe("202283242");
});

test("personal numbers are removed at any depth, other values kept", () => {
  expect(stripPersonalNumbers({ a: { b: ["01019067930", "x"] }, n: 12345678901, c: "202283242" })).toEqual({
    a: { b: [null, "x"] },
    n: null,
    c: "202283242",
  });
});

test("the secret is created once and then reused", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "procurement-secret-"));
  const first = await loadOrCreateSecret(dir);
  expect(first).toMatch(/^[0-9a-f]{64}$/);
  expect(await loadOrCreateSecret(dir)).toBe(first);
});

test("a code with a personal number inside it is replaced as a whole", () => {
  const key = partyKey("09 / 01019067930-5", SECRET);
  expect(key).toMatch(/^p_[0-9a-f]{16}$/);
  expect(key).toBe(partyKey(" 09 / 01019067930-5 ", SECRET));
  expect(key).not.toBe(partyKey("01019067930", SECRET));
});

test("a personal number inside free text is masked, other numbers kept", () => {
  expect(maskPersonalNumbers("ფ/პ ნინი (პ/ნ 01019067930), # 01019067931")).toBe("ფ/პ ნინი (პ/ნ [removed]), # [removed]");
  expect(maskPersonalNumbers("SPA160009161 1595.00 202283242 010190679301")).toBe("SPA160009161 1595.00 202283242 010190679301");
});

test("a personal number inside a registry text is masked too", () => {
  expect(stripPersonalNumbers({ note: "პ/ნ 01019067930" })).toEqual({ note: "პ/ნ [removed]" });
});
