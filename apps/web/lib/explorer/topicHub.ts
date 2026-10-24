import type { TopicId } from "../navigation/navTree";
import type { HubCardModel } from "./hubCards";

/** A card's latest figure: the one its footer prints, with its period as the page writes it (`2025`, `2025/26`, `სექ 2026`). */
export type CardLatest = { value: string; period: string; caption?: string };

/** A card's own graphic, in place of the sparkline: Unemployment's age bands, or two or three bars side by side. */
export type CardGraphic =
  | { kind: "bars"; bars: { label: string; value: number; accent: boolean }[]; first: string; last: string }
  | { kind: "pair"; rows: { label: string; value: number; text: string; accent: boolean }[]; max: number };

/** One topic's cards and the coverage its header states: the range and review date its hub passes to `coverageLabel`. */
export type TopicHubData = { topic: TopicId; lastReviewedAt: string; firstPeriod: string; lastPeriod: string; cards: HubCardModel[] };
