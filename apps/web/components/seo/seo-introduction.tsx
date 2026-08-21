import Link from "next/link";

export function SeoIntroduction({ text, methodologyHref }: { text: string; methodologyHref: string }) {
  return (
    <div data-testid="seo-introduction" className="mb-8 max-w-[820px] text-[13px] leading-[1.75] text-[var(--body)]">
      <p>{text}</p>
      <Link href={methodologyHref} className="mt-2 inline-flex text-[12px] text-[var(--accent)] underline underline-offset-4">
        მეთოდოლოგია და პირველწყაროები
      </Link>
    </div>
  );
}
