import { buildPlaceIndex } from "../../lib/explorer/places/buildPlaceIndex.server";

// The All data search's places (spec 2026-10-24-explorer-regroup §7.4), prerendered at build time and fetched the first time someone types.
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const { places, entries } = await buildPlaceIndex("en");
  return Response.json({ places, entries });
}
