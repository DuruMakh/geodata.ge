import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";

/** `{n} გვერდი` / `{n} pages`, `{n} page` for one: a group's, topic's, letter's or search's page count. `messages` holds `common`. */
export function pagesLabel(messages: Messages, n: number): string {
  return message(messages, n === 1 ? "common.pagesCountOne" : "common.pagesCount", { n });
}
