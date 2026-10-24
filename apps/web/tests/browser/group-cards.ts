import type { Page } from "@playwright/test";

// A topic's cards on its group page (spec 2026-10-24-explorer-regroup §5): the section `#t-{topic}`, one card per page.

export const topicCards = (page: Page, topic: string) => page.locator(`#t-${topic}`).getByTestId("explorer-card");

/** A card's whole accessible description: its latest figure (with any unit), that figure's period and the years it covers. */
export const cardFigure = (value: string, period: string, years: string) => `${value} ${period} ${years}`;
