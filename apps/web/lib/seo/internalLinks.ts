import { municipalityHrefForCode } from "../explorer/municipalityRoutes";

export const DEBT_EXPLORER_PATH = "/explorer/debt" as const;
export const DEFICIT_EXPLORER_PATH = "/explorer/deficit" as const;

export type MunicipalEntityKind = "country" | "region" | "municipality";

export function municipalEntityHref(kind: MunicipalEntityKind, id: string): string {
  if (kind === "country") return "/explorer/municipalities/georgia";
  if (kind === "region") {
    if (!id.startsWith("region.")) throw new Error(`Region id must start with region.: ${id}`);
    return `/explorer/municipalities/region/${id.slice("region.".length)}`;
  }
  return municipalityHrefForCode(id);
}
