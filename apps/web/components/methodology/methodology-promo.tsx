import Link from "next/link";
import type { MethodologyDatasetId } from "../../lib/methodology/catalog";
import { LINEAGE, SourceDocumentStack } from "./document-visuals";

type MethodologyPromoProps = {
  href: "/methodology" | `/methodology/${MethodologyDatasetId}`;
  titleKa: string;
  bodyKa: string;
};

export function MethodologyPromo({ href, titleKa, bodyKa }: MethodologyPromoProps) {
  return (
    <section
      data-testid="methodology-promo"
      aria-labelledby="methodology-promo-title"
      className="mt-14 grid items-center gap-10 border-y border-[var(--hairline)] py-14 min-[768px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] min-[768px]:gap-16 min-[768px]:py-20"
    >
      <div className="mx-auto w-full max-w-[430px]">
        <SourceDocumentStack />
      </div>
      <div className="max-w-[590px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">პირველწყაროდან მონაცემებამდე</p>
        <h2
          id="methodology-promo-title"
          className="mt-3 text-balance font-[family-name:var(--font-display)] text-[28px] font-semibold leading-[1.2] tracking-[-0.015em] min-[768px]:text-[34px]"
        >
          {titleKa}
        </h2>
        <p className="mt-5 font-[family-name:var(--font-numeric)] text-[10.5px] tracking-[0.08em] text-[var(--accent)]">
          {LINEAGE}
        </p>
        <p className="mt-5 max-w-[560px] text-pretty text-[14px] leading-relaxed text-[var(--body)]">{bodyKa}</p>
        <Link
          href={href}
          className="mt-7 inline-block text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[var(--ink)]"
        >
          მეთოდოლოგიისა და პირველწყაროების ნახვა
        </Link>
      </div>
    </section>
  );
}
