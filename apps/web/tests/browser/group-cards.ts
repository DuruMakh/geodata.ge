import type { Page } from "@playwright/test";

// A topic's cards on its group page (spec 2026-10-24-explorer-regroup §5): the section `#t-{topic}`, one card per page.

export const topicCards = (page: Page, topic: string) => page.locator(`#t-${topic}`).getByTestId("explorer-card");

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A card's latest figure, its period and the years it covers, in the order the card shows them. */
export const cardFigure = (value: string, period: string, years: string) => new RegExp([value, period, years].map(literal).join("[\\s\\S]*"));
