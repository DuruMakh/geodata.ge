import Link from "next/link";
import { pageHref } from "../../../lib/i18n/routes";
import type { Locale } from "../../../lib/i18n/types";
import { CopyEndpoint } from "../../connect/copy-endpoint";
import { Reveal } from "./reveal";

// The Ask AI band: a full-bleed dark section with the MCP address (always visible text, a copy
// button beside it), what the server does not need, the tool names and a card that walks one
// question to its source. Ported from the design board's section 16. The dark palette and the grain
// live in globals.css under .home-ai.

export type AiLabels = {
  title: string; // "ჰკითხე AI-ს — პასუხი წყაროსთან ერთად"
  lede: string; // "დააკავშირე Claude ან სხვა ასისტენტი…"
  meta: string; // "MCP · Streamable HTTP · ავტორიზაციის გარეშე"
  copy: string; // button text: "კოპირება"
  copied: string; // button text after copying: "დაკოპირდა"
  copyLabel: string; // button accessible name: "მისამართის კოპირება"
  copiedLabel: string; // announced after copying: "მისამართი დაკოპირდა"
  facts: string[]; // "მხოლოდ წაკითხვა", "ტოკენი არ სჭირდება", "სესიის გარეშე"
  tools: string; // label above the chips: "ინსტრუმენტები"
  cta: string; // link to /connect: "AI-კავშირის ინსტრუქცია →"
  cardTitle: string; // "როგორ მუშაობს"
  cardKicker: string; // "კითხვიდან წყარომდე"
  nodes: { title: string; text: string }[]; // five, the third is the endpoint
};

export const MCP_ENDPOINT = "https://fiscal.ge/mcp";

const COPY_BUTTON =
  "min-h-[42px] shrink-0 whitespace-nowrap rounded-[4px] bg-[var(--ai-ink)] px-4 text-[12.5px] font-semibold text-[var(--ai-bg)] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ai-link)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ai-muted)]";

export function AiSection({ tools, labels, locale }: { tools: string[]; labels: AiLabels; locale: Locale }) {
  return (
    <section id="ai" className="home-ai scroll-mt-4">
      <div aria-hidden="true" className="home-ai-grain" />
      <div className="home-ai-inner">
        <div>
          <Reveal className="border-t-[1.5px] border-[var(--ai-ink)] pt-[14px]">
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(22px,2.2vw,30px)] font-semibold leading-[1.2] tracking-[-0.01em] [text-wrap:balance]">
              {labels.title}
            </h2>
            <p className="mt-2 max-w-[860px] text-[15px] leading-[1.6] text-[var(--ai-body)] [text-wrap:pretty]">{labels.lede}</p>
            <p className="mt-2 text-xs leading-normal text-[var(--ai-muted)]">{labels.meta}</p>
          </Reveal>
          <Reveal>
            <div className="mt-[30px] flex max-w-[520px] items-center gap-3 rounded-md border border-[rgba(247,242,233,0.26)] py-1.5 pl-4 pr-1.5">
              <code className="min-w-0 flex-1 select-all break-all font-[family-name:var(--font-numeric)] text-[13px] text-white min-[400px]:text-[14.5px]">
                {MCP_ENDPOINT}
              </code>
              <CopyEndpoint
                value={MCP_ENDPOINT}
                testId="landing-ai-copy"
                copyLabel={labels.copyLabel}
                copiedLabel={labels.copiedLabel}
                copyText={labels.copy}
                copiedText={labels.copied}
                className={COPY_BUTTON}
              />
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-[var(--ai-body)]">
              {labels.facts.map((fact) => (
                <li key={fact} className="inline-flex items-center gap-2">
                  <i aria-hidden="true" className="inline-block size-1.5 bg-[var(--ai-accent)]" />
                  {fact}
                </li>
              ))}
            </ul>
            <div className={`mt-[30px] ${LABEL}`}>{labels.tools}</div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {tools.map((tool) => (
                <li
                  key={tool}
                  className="rounded-[3px] border border-[var(--ai-line)] px-2.5 py-1.5 font-[family-name:var(--font-numeric)] text-[11.5px] text-[#ece4d6]"
                >
                  {tool}
                </li>
              ))}
            </ul>
            <Link
              href={pageHref("/connect", locale)}
              prefetch={false}
              className="-mb-3 mt-[22px] inline-flex items-center py-3 text-[12.5px] font-semibold text-[var(--ai-link)] underline decoration-[1.5px] underline-offset-4 hover:text-white"
            >
              {labels.cta}
            </Link>
          </Reveal>
        </div>
        <Reveal className="self-start rounded-xl border border-[rgba(247,242,233,0.12)] bg-[var(--ai-card)] px-6 pb-5 pt-[22px] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
            <h3 className="font-[family-name:var(--font-display)] text-[19px] font-semibold leading-[1.3]">{labels.cardTitle}</h3>
            <span className="font-[family-name:var(--font-numeric)] text-[11px] uppercase tracking-[0.06em] text-[var(--ai-muted)]">
              {labels.cardKicker}
            </span>
          </div>
          <ol className="home-ai-path mt-3.5 list-none">
            {labels.nodes.map((node, index) => {
              const highlighted = index === 2;
              return (
                <li key={node.title} className="relative grid grid-cols-[22px_minmax(0,1fr)] gap-4 py-[11px]">
                  <b
                    aria-hidden="true"
                    className={`relative z-[1] mt-px size-[22px] rounded-full border-[1.5px] ${highlighted ? "border-[var(--ai-accent)] bg-[var(--ai-accent)]" : "border-[rgba(247,242,233,0.55)] bg-[var(--ai-card)]"}`}
                  />
                  <div>
                    <p
                      className={
                        highlighted
                          ? "font-[family-name:var(--font-numeric)] text-sm font-semibold leading-[1.4] text-[var(--ai-link)]"
                          : "text-[14.5px] font-semibold leading-[1.4]"
                      }
                    >
                      {node.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-[1.5] text-[var(--ai-body)]">{node.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
