import { Fragment, type ReactNode } from "react";

const LARI = "₾";

/**
 * Sets every ₾ in `text` in the UI sans face.
 *
 * Geist Mono has no lari sign, so inside mono figures ("7.2 მლრდ ₾") the browser
 * borrows it from a monospace system face, where it renders heavier and sits
 * higher than the digits. In the sans face it matches the sign used everywhere
 * else on the page. Text without ₾ is returned unchanged, so the helper is safe
 * to wrap around any formatted amount; textContent never changes.
 */
export function withLari(text: string): ReactNode {
  if (!text.includes(LARI)) return text;
  const parts = text.split(LARI);
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 ? (
        <span data-lari="" className="font-[family-name:var(--font-ui)]">
          {LARI}
        </span>
      ) : null}
    </Fragment>
  ));
}
