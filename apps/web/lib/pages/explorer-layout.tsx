import { getMessages } from "../i18n/messages.server";
import { I18nProvider } from "../i18n/provider";
import type { ReactNode } from "react";
import { DataSidebar } from "../../components/shell/data-sidebar";
import { ExplorerFooter } from "../../components/shell/explorer-footer";
import { loadServedLandingData } from "../data/servedData";
import { buildLandingContext } from "../landing/landingData";
import type { Locale } from "../i18n/types";

export async function renderExplorerLayout(locale: Locale, children: ReactNode) {
  const [landingData, messages] = await Promise.all([
    loadServedLandingData(), getMessages(locale, ["common", "controls"]),
  ]);
  const { updatedAt } = buildLandingContext(landingData);
  return (
    <I18nProvider locale={locale} messages={messages}>
      <div className="flex min-h-screen flex-col bg-[var(--paper)] min-[900px]:flex-row">
        <DataSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1">{children}</div>
          <div className="px-5 min-[768px]:px-[34px]">
            <div className="mx-auto max-w-[1180px]"><ExplorerFooter updatedAt={updatedAt} locale={locale} /></div>
          </div>
        </div>
      </div>
    </I18nProvider>
  );
}
