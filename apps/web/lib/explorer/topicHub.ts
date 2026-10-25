import type { TopicId } from "../navigation/navTree";
import type { HubCardModel } from "./hubCards";

/** A card's latest figure: the one its footer prints, with its period as the page writes it (`2025`, `2025/26`, `სექ 2026`). */
export type CardLatest = {
  value: string;
  period: string;
  caption?: string;
  /** What a group headline shows in place of `caption`, whose label already says the rest: the largest partner's name alone. */
  headlineCaption?: string;
  /** The figure is a plan, not an actual: its period then reads as the plan (`2026 გეგმა` / `2026 plan`), and a lead card draws its last point hollow. */
  planned?: boolean;
  /** The figure is preliminary in its source: the card and headline write the mark after the period (`2025 · წინასწარი`), as its page does. */
  status?: "preliminary";
};

/** A card's own graphic, in place of the sparkline: Unemployment's age bands, or two or three bars side by side, with the period they show. */
export type CardGraphic =
  | { kind: "bars"; bars: { label: string; value: number; accent: boolean }[]; first: string; last: string; period: string }
  | { kind: "pair"; rows: { label: string; value: number; text: string; accent: boolean }[]; max: number; period: string };

/** One topic's cards and the coverage its header states: the range and review date its hub passes to `coverageLabel`. */
export type TopicHubData = { topic: TopicId; lastReviewedAt: string; firstPeriod: string; lastPeriod: string; cards: HubCardModel[] };
