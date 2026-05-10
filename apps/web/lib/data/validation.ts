import { z } from "zod";

export const stableIdSchema = z
  .string()
  .regex(/^[a-z]+(\.[a-z0-9_]+)+$/, "Use lowercase ASCII dot-namespaced IDs");

export function isStableId(value: string): boolean {
  return stableIdSchema.safeParse(value).success;
}

export function requireStableId(value: string): string {
  return stableIdSchema.parse(value);
}

export function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return trimmed;
}
