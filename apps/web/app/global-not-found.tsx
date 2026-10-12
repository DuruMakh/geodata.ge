import Link from "next/link";
import type { Metadata } from "next";
import { RootDocument, rootMetadata } from "../components/site/root-document";
import "./globals.css";
import kaCommon from "../lib/i18n/messages/ka/common.json";
import enCommon from "../lib/i18n/messages/en/common.json";
import { DATASET_HUBS } from "../lib/navigation/datasetHubs";

export const metadata: Metadata = { ...rootMetadata("ka"), robots: { index: false, follow: true } };

// People-facing recovery: the homepage, the four dataset hubs and methodology.
// The XML sitemap and the agent guide stay published for machines; on a phone
// they opened raw files.
// It renders outside the i18n provider, so the hub labels come straight from the message files.
const destinations = [
  { href: "/", label: "მთავარი გვერდი" },
  ...DATASET_HUBS.map(({ href, labelKey }) => ({ href, label: kaCommon[labelKey] })),
  { href: "/methodology", label: kaCommon["common.methodology"] },
];

const englishDestinations = [
  ["/en", enCommon["common.home"]],
  ...DATASET_HUBS.map(({ href, labelKey }) => [`/en${href}`, enCommon[labelKey]] as const),
  ["/en/methodology", enCommon["common.methodology"]],
] as const;

export default function NotFound() {
  return (
    <RootDocument locale="ka"><main id="content" tabIndex={-1} className="min-h-screen outline-none bg-[var(--paper)] px-5 py-6 text-[var(--ink)] min-[768px]:px-7 min-[768px]:py-8">
      <div className="mx-auto max-w-[760px] min-[768px]:pt-[min(18vh,11rem)]">
        <section data-testid="not-found-recovery" className="border-t-2 border-[var(--ink)] pt-5">
          <p className="font-[family-name:var(--font-numeric)] text-[11px] font-medium tracking-[0.08em] text-[var(--muted)]">
            FISCAL.GE · 404
          </p>
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-[38px] font-semibold leading-[1.12] min-[768px]:text-[52px]">
            გვერდი ვერ მოიძებნა
          </h1>
          <p className="mt-5 max-w-[600px] text-[15px] leading-[1.8] text-[var(--body)]">
            მისამართი არ არსებობს ან გვერდი გადატანილია. შეგიძლიათ დაბრუნდეთ მთავარ გვერდზე ან გააგრძელოთ მონაცემების
            დათვალიერება ქვემოთ მოცემული ბმულებიდან.
          </p>
          <nav aria-label="აღდგენის ბმულები" className="mt-10 border-t border-[var(--ink)]">
            <ul>
              {destinations.map(({ href, label }) => (
                <li key={href} className="border-b border-[var(--hairline)]">
                  <Link
                    href={href}
                    prefetch={false}
                    className="flex min-h-11 items-center py-2 text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--tint)]"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>
        <section lang="en" className="mt-12 border-t border-[var(--hairline)] pt-5">
          <h2 className="font-[family-name:var(--font-display)] text-[28px] font-semibold">Page not found</h2>
          <p className="mt-4 text-[15px] leading-[1.8] text-[var(--body)]">This address does not exist or the page has moved. Continue with one of the links below.</p>
          <nav aria-label="Recovery links" className="mt-5 flex flex-wrap gap-x-5">
            {englishDestinations.map(([href, label]) => (
              <Link key={href} href={href} prefetch={false} className="flex min-h-11 items-center text-[14px] underline">{label}</Link>
            ))}
          </nav>
        </section>
      </div>
    </main></RootDocument>
  );
}
