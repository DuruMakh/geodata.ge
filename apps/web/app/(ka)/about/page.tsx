import { SiteFooter } from "../../../components/site/site-footer";
import { SiteHeader } from "../../../components/site/site-header";
import { loadServedLandingData } from "../../../lib/data/servedData";
import { buildLandingContext } from "../../../lib/landing/landingData";
import { fiscalMetadata } from "../../../lib/seo/metadata";

export const metadata = fiscalMetadata({
  title: "მიზანი — Fiscal.ge",
  description:
    "Fiscal.ge-ის მიზანია საქართველოს საჯარო ეკონომიკური და ფინანსური მონაცემები ერთ სივრცეში მოაქციოს და მარტივი, გასაგები ფორმით წარმოადგინოს.",
  path: "/about",
});

export default async function AboutPage() {
  const model = buildLandingContext(await loadServedLandingData());

  return (
    <div className="min-h-screen bg-[var(--paper)] px-5 pt-[22px] text-[var(--ink)] min-[768px]:px-7 min-[768px]:pt-[30px]">
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader active="mission" yearsLabel={model.yearsLabel} testId="about-header" />
        <main className="pt-10 min-[768px]:pt-16">
          <section
            data-testid="mission-cover"
            aria-labelledby="mission-title"
            className="grid min-h-[310px] grid-cols-[170px_minmax(0,1fr)_210px] gap-10 bg-[var(--ink)] px-10 pb-[43px] pt-[38px] text-[var(--paper)] max-[767.99px]:min-h-[350px] max-[767.99px]:grid-cols-1 max-[767.99px]:gap-0 max-[767.99px]:px-5 max-[767.99px]:py-6"
          >
            <div aria-hidden="true" className="flex min-w-0 items-start justify-between gap-3">
              <strong className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--accent)]">01</strong>
              <span className="text-right font-[family-name:var(--font-numeric)] text-[9px] leading-[1.35] tracking-[0.08em] text-[var(--paper)]">
                FISCAL.GE
                <br />
                OPEN DATA
              </span>
            </div>
            <h1
              id="mission-title"
              className="self-center font-[family-name:var(--font-display)] text-[clamp(48px,7vw,84px)] font-semibold leading-none tracking-[-0.035em] text-[var(--paper)] max-[767.99px]:mt-12 max-[767.99px]:self-start max-[767.99px]:text-[clamp(48px,16vw,72px)]"
            >
              მიზანი
            </h1>
            <span className="self-end font-[family-name:var(--font-numeric)] text-[10px] leading-[1.45] tracking-[0.08em] text-[var(--paper)] max-[767.99px]:mt-12">
              {model.updatedAt.slice(0, 4)}
              <br />
              MISSION NOTE
            </span>
          </section>

          <article
            data-testid="mission-copy"
            aria-label="მიზნის ტექსტი"
            className="mx-auto mt-[72px] max-w-[760px] font-[family-name:var(--font-ui)] text-[16px] leading-[1.96] text-[var(--body)] max-[767.99px]:mt-[48px] max-[767.99px]:px-0 max-[767.99px]:text-[15px] max-[767.99px]:leading-[1.88]"
          >
            <p className="first-letter:float-left first-letter:mr-2 first-letter:mt-[5px] first-letter:font-[family-name:var(--font-display)] first-letter:text-[58px] first-letter:font-semibold first-letter:leading-[0.8] first-letter:text-[var(--accent)] max-[767.99px]:first-letter:text-[50px]">
              საქართველოში ეკონომიკის, სახელმწიფო ფინანსების, რეგიონების, ვაჭრობის, ბიზნესისა და სხვა მნიშვნელოვანი მიმართულებების შესახებ დიდი რაოდენობით საჯარო მონაცემები არსებობს. თუმცა ეს ინფორმაცია სხვადასხვა უწყების ვებგვერდებზე, ექსელის ფაილებში, ანგარიშებსა და რთულ ცხრილებშია გაფანტული. ხშირად ერთი მარტივი პასუხის მისაღებადაც კი საჭიროა რამდენიმე წყაროს მოძიება, მონაცემების ჩამოტვირთვა, დამუშავება და ერთმანეთთან შედარება.
            </p>
            <p className="mt-[39px]">
              პრობლემა მხოლოდ ინფორმაციის მოძიება არ არის. არსებული მონაცემები ხშირად წარმოდგენილია ისეთი ფორმით, რომელიც სპეციალური ცოდნის გარეშე რთულად გასაგებია. ასევე რთულია სხვადასხვა წლის მონაცემების, სხვადასხვა რეგიონისა თუ ეკონომიკური მაჩვენებლების ერთმანეთთან შედარება და საერთო სურათის დანახვა. შედეგად, საჯაროდ ხელმისაწვდომი მონაცემების მნიშვნელოვანი ნაწილი პრაქტიკაში მხოლოდ ადამიანთა მცირე წრისთვის არის მარტივად გამოსაყენებელი.
            </p>
            <p className="mt-[39px]">
              fiscal.ge სწორედ ამ პრობლემის გადასაჭრელად შეიქმნა. ჩვენი მიზანია საქართველოს შესახებ საჯაროდ ხელმისაწვდომი ეკონომიკური და ფინანსური მონაცემების დიდი ნაწილი ერთ სივრცეში მოვაქციოთ, დავალაგოთ, ერთმანეთთან დავაკავშიროთ და მარტივი, ვიზუალურად გასაგები ფორმით წარმოვადგინოთ.
            </p>
            <p
              data-testid="mission-closing"
              className="mt-[39px] py-[25px] pb-[27px] text-[16px] leading-[1.96] text-[var(--body)] max-[767.99px]:mt-[31px] max-[767.99px]:py-[20px] max-[767.99px]:pb-[23px] max-[767.99px]:text-[15px] max-[767.99px]:leading-[1.88]"
            >
              გვინდა, მომხმარებელს რამდენიმე საათის ძიების ნაცვლად, რამდენიმე წამში შეეძლოს საჭირო მონაცემის პოვნა, მისი შედარება და კონტექსტის დანახვა.{" "}
              <strong className="mt-[21px] block border-l-4 border-[var(--accent)] pl-[25px] font-[family-name:var(--font-display)] text-[clamp(25px,3.2vw,38px)] font-semibold leading-[1.45] tracking-[-0.02em] text-[var(--ink)] max-[767.99px]:mt-[18px] max-[767.99px]:pl-[18px] max-[767.99px]:text-[23px]">
                ჩვენი მიზანია, საქართველოს მონაცემები იყოს არა მხოლოდ საჯარო, არამედ რეალურად ხელმისაწვდომი, გასაგები და გამოყენებადი.
              </strong>
            </p>
          </article>
        </main>
        <SiteFooter updatedAt={model.updatedAt} />
      </div>
    </div>
  );
}
