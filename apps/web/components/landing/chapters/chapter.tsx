import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { ChapterLink } from "../../../lib/landing/chapters/types";
import { Reveal } from "./reveal";

// Shared frame of every homepage chapter: 1.5px ink rule, display-serif heading (a link to the
// chapter's explorer page when `link` is set), one lede line, then the chapter body.
// The title's last word keeps the arrow with it, so the arrow never wraps onto a line alone.
function ChapterTitle({ title, link }: { title: string; link: ChapterLink | null }) {
  if (!link) return <>{title}</>;
  const cut = title.lastIndexOf(" ");
  const head = cut < 0 ? "" : `${title.slice(0, cut)} `;
  const last = cut < 0 ? title : title.slice(cut + 1);
  return (
    <Link href={link.href} className="home-tl">
      {head}
      <span className="relative whitespace-nowrap">
        {last}
        <ArrowRight aria-hidden strokeWidth={2} className="home-tl-i" />
        <span aria-hidden className="home-tl-hint">
          {link.hint}
        </span>
      </span>
      <span className="sr-only"> — {link.hint}</span>
    </Link>
  );
}

export function Chapter({
  id,
  link,
  title,
  lede,
  first = false,
  children,
}: {
  id: string;
  link: ChapterLink | null;
  title: string;
  lede: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`relative scroll-mt-4 ${first ? "mt-16" : "mt-[72px] min-[768px]:mt-24"}`}>
      <Reveal className="border-t-[1.5px] border-[var(--ink)] pt-[14px]">
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(22px,2.2vw,30px)] font-semibold leading-[1.2] tracking-[-0.01em] text-[var(--ink)] [text-wrap:balance]">
          <ChapterTitle title={title} link={link} />
        </h2>
        <p className="mt-2 max-w-[860px] text-[15px] leading-[1.6] text-[var(--body)] [text-wrap:pretty]">{lede}</p>
      </Reveal>
      {children}
    </section>
  );
}
