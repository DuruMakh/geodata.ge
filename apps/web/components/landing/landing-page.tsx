import Link from "next/link";
import type { LandingModel } from "../../lib/landing/landingData";
import { MethodologyPromo } from "../methodology/methodology-promo";
import { SiteFooter } from "../site/site-footer";
import { SiteHeader } from "../site/site-header";
import { HeroReliefLazy } from "./hero-relief-lazy";

// Landing page (GeoData Site v2 design): header, living-relief hero, key country
// numbers, the three paths to the data, and the site footer. Static figures
// (population, area, GDP) are maintained here by hand; everything budget-derived
// comes from LandingModel so the landing always matches the explorer.

const KEY_NUMBERS = [
  { label: "მოსახლეობა", value: "3.7", unit: "მლნ", caption: "მუდმივი მოსახლეობა" },
  { label: "ფართობი", value: "69.7", unit: "ათ. კმ²", caption: "ზღვის დონიდან 0–5193 მ" },
  // Geostat preliminary 2025 nominal GDP: 104.6 bln GEL (+12.4% YoY).
  { label: "ეკონომიკის ზომა", value: "104.6", unit: "მლრდ ₾", caption: "ნომინალური მშპ · 2025, წინასწარი" },
] as const;

const ANALYSIS_HREF = "/explorer/analysis";

const HERO_ARIA_LABEL =
  "საქართველოს ზუსტი რუკა ცოცხალ რელიეფად: მთავარი ქალაქები მოსახლეობის ზომის კვადრატებით უშვებენ ტალღებს; კავკასიონი მუქდება სიმაღლესთან ერთად";

function PathCardLabel({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
      <span className="font-[family-name:var(--font-numeric)] text-[var(--faint)]">{index}</span> · {children}
    </div>
  );
}

function PathCardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-auto self-start text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222]"
    >
      {children}
    </Link>
  );
}

export function LandingPage({ model }: { model: LandingModel }) {
  return (
    <main
      data-testid="landing-shell"
      className="min-h-screen bg-[var(--paper)] px-5 pt-[22px] text-[var(--ink)] min-[768px]:px-7 min-[768px]:pt-[30px]"
    >
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader active="home" yearsLabel={model.yearsLabel} testId="landing-header" />

        <section className="relative">
          <div
            data-hero-copy
            className="pb-[18px] pt-7 min-[768px]:pointer-events-none min-[768px]:absolute min-[768px]:right-0 min-[768px]:top-[42px] min-[768px]:z-10 min-[768px]:flex min-[768px]:w-[340px] min-[768px]:flex-col min-[768px]:items-end min-[768px]:p-0 min-[768px]:text-right min-[1100px]:w-[470px]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)] min-[768px]:text-[11px]">
              ეროვნული სტატისტიკის პლატფორმა
            </p>
            <h1 className="mt-2.5 text-pretty font-[family-name:var(--font-display)] text-[31px] font-semibold leading-[1.16] tracking-[-0.015em] min-[768px]:mt-3 min-[768px]:text-balance min-[768px]:text-[28px] min-[1100px]:text-[40px]">
              როგორ ივსება და იხარჯება საქართველოს ბიუჯეტი
            </h1>
            <div className="mt-3.5 min-[768px]:pointer-events-auto min-[768px]:mt-5">
              <Link
                href="/explorer"
                data-testid="hero-cta"
                className="text-[12px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222] min-[768px]:text-[12.5px]"
              >
                დაიწყე ბიუჯეტით
              </Link>
            </div>
          </div>
          {/* Full-bleed: the map is the hero — it escapes the 1240px column and
              spans the whole viewport; the headline stays in the content grid. */}
          <figure
            role="img"
            aria-label={HERO_ARIA_LABEL}
            className="relative m-0 ml-[calc(50%-50vw)] h-[340px] w-screen min-w-0 overflow-hidden p-0 min-[768px]:h-[500px] min-[1100px]:h-[clamp(560px,78vh,820px)]"
          >
            <HeroReliefLazy />
          </figure>
        </section>

        <section
          data-testid="key-numbers"
          className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-8 border-t border-[var(--hairline-soft)] pt-[18px]"
        >
          {KEY_NUMBERS.map((entry) => (
            <div key={entry.label}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{entry.label}</div>
              <div className="mt-2.5 font-[family-name:var(--font-display)] text-[46px] font-semibold leading-[1.05] tracking-[-0.02em]">
                {entry.value} <span className="text-[25px]">{entry.unit}</span>
              </div>
              <div className="mt-2 text-[12px] leading-normal text-[var(--muted)]">{entry.caption}</div>
            </div>
          ))}
        </section>

        <section data-testid="three-paths" className="mt-14 border-t-2 border-[var(--ink)] pt-[22px]">
          <h2 className="mb-[26px] font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-[-0.01em]">
            სამი გზა მონაცემებამდე
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-9">
            <div className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-4">
              <PathCardLabel index="01">მრავალწლიანი ექსპლორერი</PathCardLabel>
              <p className="text-pretty text-[13.5px] leading-relaxed text-[var(--body)]">
                ხაზები და ცხრილები {model.revMin} წლიდან დღემდე: აირჩიე კატეგორიები, შეადარე პერიოდები, ნახე წილები.
              </p>
              <div className="mt-1.5">
                <svg viewBox="0 0 260 84" className="block h-auto w-full max-w-[340px]" role="img" aria-label="ჯამური შემოსავლების დინამიკა">
                  {model.sparkVat ? (
                    <polyline
                      points={model.sparkVat}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity="0.75"
                    />
                  ) : null}
                  <polyline
                    points={model.sparkTotal}
                    fill="none"
                    stroke="var(--ink)"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <circle cx={model.sparkEndX} cy={model.sparkEndY} r="2.6" fill="var(--ink)" />
                </svg>
                <div className="mt-1 flex max-w-[340px] justify-between">
                  <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{model.revMin}</span>
                  <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{model.revMax}</span>
                </div>
              </div>
              <PathCardLink href="/explorer">ექსპლორერის გახსნა</PathCardLink>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-4">
              <PathCardLabel index="02">ერთი წლის სურათი</PathCardLabel>
              <p className="text-pretty text-[13.5px] leading-relaxed text-[var(--body)]">
                სტრუქტურა, ყოველი 100 ლარი, რადარი და სრული რეიტინგი — ერთი წლის ბიუჯეტი ერთ გვერდზე.
              </p>
              <div className="mt-1.5 max-w-[340px]">
                <div data-testid="waffle-grid" className="grid grid-cols-10 gap-1">
                  {model.waffleCells.map((color, index) => (
                    <div key={index} className="aspect-square" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div className="mt-1.5 font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">
                  ხარჯების სტრუქტურა · {model.expMax}
                </div>
              </div>
              <PathCardLink href={ANALYSIS_HREF}>სურათის ნახვა</PathCardLink>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-4">
              <PathCardLabel index="03">Excel მონაცემები</PathCardLabel>
              <p className="text-pretty text-[13.5px] leading-relaxed text-[var(--body)]">
                ექსპლორერში შერჩეული მონაცემები ჩამოტვირთე ერთ Excel ფაილად — წასაკითხად და ანალიზისთვის.
              </p>
              <div className="mt-1.5 max-w-[340px] bg-[var(--tint)] px-3.5 py-3">
                <div className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--muted)]">
                  {model.excelPreview.sheetNames.map((sheetName, index) => (
                    <span key={sheetName}>
                      {index > 0 ? " · " : null}
                      <span>{sheetName}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-x-2 text-[10.5px] font-[family-name:var(--font-numeric)]">
                  {model.excelPreview.headers.map((header, index) => (
                    <div key={header} className={index === 0 ? "text-[var(--muted)]" : "text-right text-[var(--muted)]"}>
                      {header}
                    </div>
                  ))}
                  {model.excelPreview.rows.map(([label, previousValue, latestValue]) => (
                    <div key={label} className="contents text-[var(--body)]">
                      <div className="truncate">{label}</div>
                      <div className="text-right">{previousValue.toLocaleString("en-US")}</div>
                      <div className="text-right">{latestValue.toLocaleString("en-US")}</div>
                    </div>
                  ))}
                </div>
              </div>
              <PathCardLink href="/explorer">ექსპლორერში ჩამოტვირთვა</PathCardLink>
            </div>
          </div>
        </section>

        <MethodologyPromo
          href="/methodology"
          titleKa="როგორ იქცევა ოფიციალური წყარო ღია მონაცემად"
          bodyKa="გაეცანით თითოეული კრებულის სრულ მეთოდოლოგიას, გადამოწმების წესებსა და უცვლელ ოფიციალურ დოკუმენტებს."
        />

        <SiteFooter updatedAt={model.updatedAt} />
      </div>
    </main>
  );
}
