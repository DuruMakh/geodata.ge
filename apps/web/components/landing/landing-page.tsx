import localFont from "next/font/local";
import Link from "next/link";
import type { LandingModel } from "../../lib/landing/landingData";
import { SiteFooter } from "../site/site-footer";
import { SiteHeader } from "../site/site-header";
import { HeroReliefLazy } from "./hero-relief-lazy";
import { LandingDatasetSection } from "./landing-dataset-section";

// Hero display face, used by the landing H1 alone. Declared here rather than in
// the root layout so only this route preloads it. The Mkhedruli codepoints carry
// Mtavruli glyphs, so the heading renders as caps while the DOM text — and with
// it search indexing and screen readers — stays Mkhedruli.
const heroDisplay = localFont({
  src: "../../assets/fonts/EurostileGEOMt-Demi.ttf",
  weight: "600",
  style: "normal",
  display: "swap",
  fallback: ["Noto Serif Georgian", "serif"],
});

// Country snapshots are maintained by hand; every budget value below them is
// derived from the same active facts as the matching explorer.
const KEY_NUMBERS = [
  {
    label: "მოსახლეობა",
    value: "3.9",
    unit: "მლნ",
    caption: "2026 წლის 1 იანვარი · საქსტატი",
    mobileCaption: "2026 · საქსტატი",
    unitTestId: "population-unit",
  },
  {
    label: "ფართობი",
    value: "69.7",
    unit: "ათ. კმ²",
    caption: "საქართველოს ტერიტორია",
    mobileCaption: "ტერიტორია",
    unitTestId: "area-unit",
  },
  {
    label: "ეკონომიკის ზომა",
    value: "104.6",
    unit: "მლრდ ₾",
    caption: "ნომინალური მშპ · 2025, წინასწარი",
    mobileCaption: "მშპ · 2025",
    unitTestId: "gdp-unit",
  },
] as const;

const HERO_ARIA_LABEL =
  "საქართველოს ზუსტი რუკა ცოცხალ რელიეფად: მთავარი ქალაქები მოსახლეობის ზომის კვადრატებით უშვებენ ტალღებს; კავკასიონი მუქდება სიმაღლესთან ერთად";

const METHODOLOGY_STEPS = [
  "ოფიციალური დოკუმენტის შენარჩუნება",
  "კლასიფიკაცია და გარდაქმნის წესი",
  "შეჯერება და ხარისხის შემოწმება",
  "ჩამოსატვირთი მონაცემები",
] as const;

export function LandingPage({ model }: { model: LandingModel }) {
  return (
    <main
      data-testid="landing-shell"
      className="min-h-screen bg-[var(--paper)] px-5 pt-[22px] text-[var(--ink)] min-[768px]:px-7 min-[768px]:pt-[30px]"
    >
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader active="home" yearsLabel={model.yearsLabel} testId="landing-header" />

        <section className="relative min-[768px]:grid min-[768px]:grid-cols-1">
          <div
            data-hero-copy
            className="pb-[18px] pt-7 min-[768px]:pointer-events-none min-[768px]:col-start-1 min-[768px]:row-start-1 min-[768px]:z-10 min-[768px]:mb-6 min-[768px]:mt-[42px] min-[768px]:flex min-[768px]:w-[340px] min-[768px]:flex-col min-[768px]:items-end min-[768px]:self-start min-[768px]:justify-self-end min-[768px]:p-0 min-[768px]:text-right min-[1100px]:w-[470px]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)] min-[768px]:text-[11px]">
              საქართველოს მონაცემების პორტალი
            </p>
            <h1
              className={`mt-2.5 text-pretty text-[33px] font-semibold leading-[1.12] tracking-[-0.015em] min-[768px]:mt-3 min-[768px]:text-[30px] min-[1100px]:text-[40px] ${heroDisplay.className}`}
            >
              საქართველო ციფრებში
            </h1>
            <div className="mt-3.5 min-[768px]:pointer-events-auto min-[768px]:mt-5">
              <Link
                href="#data"
                data-testid="hero-cta"
                className="text-[12px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222] min-[768px]:text-[12.5px]"
              >
                გაეცანი მონაცემებს
              </Link>
            </div>
          </div>
          <figure
            role="img"
            aria-label={HERO_ARIA_LABEL}
            className="landing-hero-frame relative m-0 ml-[calc(50%-50vw)] w-screen min-w-0 overflow-hidden p-0 min-[768px]:col-start-1 min-[768px]:row-start-1"
          >
            <HeroReliefLazy />
          </figure>
        </section>

        <section
          data-testid="key-numbers"
          className="grid grid-cols-3 gap-3 border-t border-[var(--hairline-soft)] pt-[18px] min-[768px]:gap-8"
        >
          {KEY_NUMBERS.map((entry) => (
            <div key={entry.label} data-country-stat className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] min-[768px]:text-[11px] min-[768px]:tracking-[0.08em]">
                {entry.label}
              </div>
              <div className="mt-2 font-[family-name:var(--font-display)] text-[clamp(22px,7vw,46px)] font-semibold leading-[1.05] tracking-[-0.02em]">
                {entry.value}{" "}
                <span
                  data-testid={entry.unitTestId}
                  className="text-[clamp(11px,3vw,25px)] max-[380px]:mt-1 max-[380px]:block"
                >
                  {entry.unit}
                </span>
              </div>
              <div className="mt-2 text-[9px] leading-snug text-[var(--muted)] min-[768px]:text-[12px]">
                <span className="hidden min-[381px]:inline">{entry.caption}</span>
                <span aria-hidden="true" className="min-[381px]:hidden">
                  {entry.mobileCaption}
                </span>
                <span className="sr-only min-[381px]:hidden">{entry.caption}</span>
              </div>
            </div>
          ))}
        </section>

        <div id="data" data-testid="landing-data" className="mt-14 scroll-mt-4 border-t-2 border-[var(--ink)]">
          <LandingDatasetSection
            kind="expenditure"
            index="01"
            overline="სახელმწიფო ხარჯები"
            heading="როგორ იხარჯება საქართველოს ბიუჯეტი"
            description={`ნახე ${model.expenditure.latestYear} წლის ხარჯები სფეროების, სამინისტროებისა და ძირითადი პროგრამების მიხედვით.`}
            href="/explorer/expenditure"
            linkLabel="ხარჯების მონაცემები →"
            totalLabel="მთლიანი ხარჯი"
            firstColumnLabel="სფერო"
            summary={model.expenditure}
          />
          <LandingDatasetSection
            kind="revenue"
            index="02"
            overline="სახელმწიფო შემოსავლები"
            heading="როგორ ფინანსდება საქართველოს ბიუჯეტი"
            description={`ნახე ${model.revenue.latestYear} წლის გადასახადები, გრანტები, სხვა შემოსავლები და ვალდებულებები.`}
            href="/explorer/revenue"
            linkLabel="შემოსავლების მონაცემები →"
            totalLabel="მთლიანი შემოსავლები"
            firstColumnLabel="მუხლი"
            summary={model.revenue}
          />
          <LandingDatasetSection
            kind="municipalities"
            index="03"
            overline="მუნიციპალური ბიუჯეტები"
            heading="როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები"
            description={`64 მუნიციპალიტეტისა და 11 რეგიონის ${model.municipalities.latestYear} წლის ბიუჯეტები.`}
            href="/explorer/municipalities"
            linkLabel="მუნიციპალური მონაცემები →"
            totalLabel="საქართველოს მუნიციპალური ჯამი"
            firstColumnLabel="უდიდესი მუნიციპალური ბიუჯეტები"
            summary={model.municipalities}
          />

          <section
            data-testid="landing-methodology"
            aria-labelledby="landing-methodology-title"
            className="grid gap-5 border-t border-[var(--hairline)] py-8 min-[850px]:grid-cols-[52px_minmax(230px,0.82fr)_minmax(0,1.35fr)] min-[850px]:gap-8 min-[850px]:py-11"
          >
            <div aria-hidden="true" className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--accent)]">
              04
            </div>
            <h2
              id="landing-methodology-title"
              className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-[1.16]"
            >
              მეთოდოლოგია და პირველწყაროები
            </h2>
            <div>
              <p className="text-[13px] leading-[1.75] text-[var(--body)]">
                თითოეული რიცხვი უკავშირდება ოფიციალურ წყაროს, კლასიფიკაციის წესსა და გადამოწმების შედეგს.
              </p>
              <ol className="mt-5 border-t border-[var(--hairline-soft)]">
                {METHODOLOGY_STEPS.map((label, index) => (
                  <li
                    key={label}
                    className="grid grid-cols-[28px_1fr] gap-3 border-b border-[var(--hairline-soft)] py-2.5 text-[11.5px] text-[var(--body)]"
                  >
                    <span aria-hidden="true" className="font-[family-name:var(--font-numeric)] text-[var(--faint)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ol>
              <Link
                href="/methodology"
                className="mt-4 inline-flex text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4"
              >
                მეთოდოლოგიის ნახვა →
              </Link>
            </div>
          </section>
        </div>

        <SiteFooter updatedAt={model.updatedAt} />
      </div>
    </main>
  );
}
