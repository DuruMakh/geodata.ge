import Link from "next/link";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { loadServedLandingData } from "../data/servedData";
import { buildLandingContext } from "../landing/landingData";
import { fiscalMetadata } from "../seo/metadata";

export async function aboutPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["about"]);
  return fiscalMetadata({ locale,
  title: message(messages, "about.metaTitle"),
  description:
    message(messages, "about.metaDescription"),
  path: "/about",
  });
}

export async function renderAboutPage(locale: Locale) {
  const messages = await getMessages(locale, ["about"]);
  const model = buildLandingContext(await loadServedLandingData());

  return (
    <div className="min-h-screen bg-[var(--paper)] px-5 pt-[22px] text-[var(--ink)] min-[768px]:px-7 min-[768px]:pt-[30px]">
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader locale={locale} active="mission" testId="about-header" />
        <main className="pt-10 min-[768px]:pt-16">
          <section
            data-testid="mission-cover"
            aria-labelledby="mission-title"
            className="grid min-h-[310px] grid-cols-[170px_minmax(0,1fr)_210px] gap-10 bg-[var(--ink)] px-10 pb-[43px] pt-[38px] text-[var(--paper)] max-[767.99px]:min-h-[200px] max-[767.99px]:grid-cols-1 max-[767.99px]:gap-0 max-[767.99px]:px-5 max-[767.99px]:py-6"
          >
            <div aria-hidden="true" className="flex min-w-0 items-start justify-between gap-3">
              <strong className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--accent)]">01</strong>
              <span className="text-right font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9px] leading-[1.35] tracking-[0.08em] text-[var(--paper)]">
                FISCAL.GE
                <br />
                OPEN DATA
              </span>
            </div>
            <h1
              id="mission-title"
              className="self-center font-[family-name:var(--font-display)] text-[clamp(48px,7vw,84px)] font-semibold leading-none tracking-[-0.035em] text-[var(--paper)] max-[767.99px]:mt-5 max-[767.99px]:self-start max-[767.99px]:text-[clamp(48px,16vw,72px)]"
            >
              {message(messages, "about.heading")}
            </h1>
            <span className="self-end font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10px] leading-[1.45] tracking-[0.08em] text-[var(--paper)] max-[767.99px]:mt-5">
              {model.updatedAt.slice(0, 4)}
              <br />
              MISSION NOTE
            </span>
          </section>

          <article
            data-testid="mission-copy"
            aria-label={message(messages, "about.articleAria")}
            className="mx-auto mt-[72px] max-w-[760px] font-[family-name:var(--font-ui)] text-[16px] leading-[1.96] text-[var(--body)] max-[767.99px]:mt-[48px] max-[767.99px]:px-0 max-[767.99px]:text-[15px] max-[767.99px]:leading-[1.88]"
          >
            <p className="first-letter:float-left first-letter:mr-2 first-letter:mt-[5px] first-letter:font-[family-name:var(--font-display)] first-letter:text-[58px] first-letter:font-semibold first-letter:leading-[0.8] first-letter:text-[var(--accent)] max-[767.99px]:first-letter:text-[50px]">
              {message(messages, "about.paragraph1")}
            </p>
            <p className="mt-[39px]">
              {message(messages, "about.paragraph2")}
            </p>
            <p className="mt-[39px]">
              {message(messages, "about.paragraph3")}
            </p>
            <p
              data-testid="mission-closing"
              className="mt-[39px] py-[25px] pb-[27px] text-[16px] leading-[1.96] text-[var(--body)] max-[767.99px]:mt-[31px] max-[767.99px]:py-[20px] max-[767.99px]:pb-[23px] max-[767.99px]:text-[15px] max-[767.99px]:leading-[1.88]"
            >
              {message(messages, "about.closing")}{" "}
              <strong className="mt-[21px] block border-l-4 border-[var(--accent)] pl-[25px] font-[family-name:var(--font-display)] text-[clamp(25px,3.2vw,38px)] font-semibold leading-[1.45] tracking-[-0.02em] text-[var(--ink)] max-[767.99px]:mt-[18px] max-[767.99px]:pl-[18px] max-[767.99px]:text-[23px]">
                {message(messages, "about.statement")}
              </strong>
            </p>
            {/* The essay ended with no way back to the data before the footer. */}
            <Link
              data-testid="mission-explore"
              href={pageHref("/explorer", locale)}
              className="inline-flex min-h-11 items-center text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222]"
            >
              {message(messages, "about.exploreLink")}
            </Link>
          </article>
        </main>
        <SiteFooter locale={locale} updatedAt={model.updatedAt} />
      </div>
    </div>
  );
}
