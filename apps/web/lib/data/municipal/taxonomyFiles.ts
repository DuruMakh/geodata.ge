import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { MunicipalFunction, MunicipalRegion } from "./types";

const municipalFunctionSchema = z.object({
  id: z.string().regex(/^municipal\.[a-z0-9_]+$/, "municipal function IDs use municipal.*"),
  kaLabel: z.string().min(1),
  functionalCode: z.string().regex(/^7\.\d+$/, "functional codes are 7.1 through 7.10"),
  sortOrder: z.number().int().positive(),
});

const municipalRegionSchema = z.object({
  id: z.string().regex(/^region\.[a-z0-9_]+$/, "region IDs use region.*"),
  kaLabel: z.string().min(1),
  sortOrder: z.number().int().positive(),
});

async function readJsonFile(relativePath: string): Promise<unknown> {
  const filePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

export async function loadMunicipalFunctionsFile(
  relativePath: string,
): Promise<MunicipalFunction[]> {
  return z.array(municipalFunctionSchema).parse(await readJsonFile(relativePath));
}

export async function loadMunicipalRegionsFile(relativePath: string): Promise<MunicipalRegion[]> {
  return z.array(municipalRegionSchema).parse(await readJsonFile(relativePath));
}
