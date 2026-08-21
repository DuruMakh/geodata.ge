import Link from "next/link";

const ANALYSIS_HREF = "/explorer/analysis";

export function SiteFooter({ updatedAt }: { updatedAt: string }) {
  return (
    <footer data-testid="site-footer" className="mt-[72px] border-t-2 border-[var(--ink)] pb-10 pt-[26px]">
      <div data-testid="landing-footer">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-9">
          <div className="flex flex-col gap-2.5">
            <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.01em]">Fiscal.ge</span>
            <p className="max-w-[260px] text-pretty text-[12.5px] leading-relaxed text-[var(--body)]">
              საქართველოს ბიუჯეტი — ნათლად, გადამოწმებულად, ღიად.
            </p>
            <a
              href="mailto:info@fiscal.ge"
              className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--accent)] underline underline-offset-[3px]"
            >
              info@fiscal.ge
            </a>
          </div>
          <div className="flex flex-col gap-[9px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">ნავიგაცია</span>
            <Link href="/explorer" className="text-[12.5px] text-[var(--body)] hover:text-[var(--ink)]">
              მრავალწლიანი ექსპლორერი
            </Link>
            <Link href={ANALYSIS_HREF} className="text-[12.5px] text-[var(--body)] hover:text-[var(--ink)]">
              ერთი წლის სურათი
            </Link>
            <Link href="/methodology" className="text-[12.5px] text-[var(--body)] hover:text-[var(--ink)]">
              მეთოდოლოგია
            </Link>
          </div>
          <div className="flex max-w-[340px] flex-col gap-[9px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">მონაცემები</span>
            <p className="text-pretty text-[12px] leading-relaxed text-[var(--muted)]">
              მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო). ბოლო განახლება:{" "}
              <span className="font-[family-name:var(--font-numeric)]">{updatedAt}</span>.
            </p>
            <p className="text-pretty text-[12px] leading-relaxed text-[var(--muted)]">
              მონაცემები ქვეყნდება CC BY 4.0 ლიცენზიით — მიუთითე წყარო და გამოიყენე თავისუფლად.
            </p>
          </div>
        </div>
        <div className="mt-[30px] flex flex-wrap justify-between gap-4 border-t border-[var(--hairline-soft)] pt-3.5">
          <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">© 2026 Fiscal.ge</span>
          <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">CC BY 4.0</span>
        </div>
      </div>
    </footer>
  );
}
