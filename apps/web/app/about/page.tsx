import Link from "next/link";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { loadServedLandingData } from "../../lib/data/servedData";
import { buildLandingModel } from "../../lib/landing/landingData";
import { fiscalMetadata } from "../../lib/seo/metadata";

export const metadata = fiscalMetadata({
  title: "Fiscal.ge-ის შესახებ — მონაცემები, წყაროები და შესწორებები",
  description:
    "როგორ ამოწმებს და აქვეყნებს Fiscal.ge საქართველოს საბიუჯეტო მონაცემებს, როგორ მიუთითოთ წყარო და როგორ გვაცნობოთ შესაძლო შეცდომა.",
  path: "/about",
});

const sections = [
  {
    title: "რას ვაქვეყნებთ",
    body: "Fiscal.ge არის დამოუკიდებელი, ქართულენოვანი საბიუჯეტო მონაცემების ექსპლორერი. პლატფორმა აჩვენებს საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებულ მრავალწლიან მონაცემებს; ის არ ცვლის ოფიციალურ სამართლებრივ დოკუმენტებს.",
  },
  {
    title: "როგორ ვამოწმებთ მონაცემებს",
    body: "ოფიციალური დოკუმენტები ინახება პირველწყაროს სახით, მონაცემები გადის კლასიფიკაციის, ჯამების, პერიოდისა და ფაქტი/გეგმის შემოწმებას, ხოლო მიღებული გადაწყვეტილებები საჯარო მეთოდოლოგიაში აისახება.",
  },
  {
    title: "შესწორებების პოლიტიკა",
    body: "შესაძლო შეცდომის დადასტურებისას ვაახლებთ მონაცემს, შესაბამის მეთოდოლოგიურ ჩანაწერსა და ბოლო განხილვის თარიღს. რიცხვითი შესწორება წყაროსა და განმარტების უხმოდ არ ქვეყნდება.",
  },
  {
    title: "როგორ მიუთითოთ წყარო",
    body: "ციტირების რეკომენდებული ფორმაა: „Fiscal.ge, საქართველოს საბიუჯეტო მონაცემები, შესაბამისი კრებული და წლები, წვდომის თარიღი“. ბმული მიუთითეთ იმ გვერდზე ან CSV ფაილზე, რომელიც გამოიყენეთ.",
  },
  {
    title: "ლიცენზია და პირველწყაროების უფლებები",
    body: "Fiscal.ge-ის დამუშავებული მონაცემები ქვეყნდება CC BY 4.0 ლიცენზიით — წყაროს მითითებით მათი გამოყენება თავისუფალია. ოფიციალური პირველწყაროების უფლებრივი სტატუსი ცალკე ინახება თითოეული ფაილის მანიფესტში და Fiscal.ge-ის ლიცენზია მათზე არ ვრცელდება.",
  },
] as const;

export default async function AboutPage() {
  const model = buildLandingModel(await loadServedLandingData());
  return (
    <div className="min-h-screen bg-[var(--paper)] px-5 pt-[22px] text-[var(--ink)] min-[768px]:px-7 min-[768px]:pt-[30px]">
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "Fiscal.ge-ის შესახებ", path: "/about" }]} />
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader yearsLabel={model.yearsLabel} testId="about-header" />
        <main className="pt-10 min-[768px]:pt-16">
          <header className="border-t-2 border-[var(--ink)] pt-8">
            <h1 className="max-w-[860px] font-[family-name:var(--font-display)] text-[38px] font-semibold leading-[1.12] min-[768px]:text-[52px]">
              Fiscal.ge-ის შესახებ
            </h1>
            <p className="mt-5 max-w-[760px] text-[15px] leading-[1.8] text-[var(--body)]">
              საქართველოს ბიუჯეტი — ნათლად, გადამოწმებულად და ღიად.
            </p>
          </header>
          <div className="mt-12 grid gap-10 min-[900px]:grid-cols-2">
            {sections.map((section) => (
              <section key={section.title} className="border-t border-[var(--ink)] pt-5">
                <h2 className="font-[family-name:var(--font-display)] text-[23px] font-semibold">{section.title}</h2>
                <p className="mt-3 text-[13.5px] leading-[1.8] text-[var(--body)]">{section.body}</p>
              </section>
            ))}
            <section className="border-t border-[var(--ink)] pt-5">
              <h2 className="font-[family-name:var(--font-display)] text-[23px] font-semibold">კონტაქტი</h2>
              <p className="mt-3 text-[13.5px] leading-[1.8] text-[var(--body)]">
                შესაძლო შეცდომა ან მონაცემთან დაკავშირებული შეკითხვა გამოგვიგზავნეთ მისამართზე{" "}
                <a href="mailto:info@fiscal.ge" className="text-[var(--accent)] underline underline-offset-4">info@fiscal.ge</a>.
              </p>
              <Link href="/methodology" className="mt-3 inline-flex text-[12.5px] text-[var(--accent)] underline underline-offset-4">
                მეთოდოლოგია და პირველწყაროები
              </Link>
            </section>
          </div>
        </main>
        <SiteFooter updatedAt={model.updatedAt} />
      </div>
    </div>
  );
}
