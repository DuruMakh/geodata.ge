import { getMessages } from "../i18n/messages.server";
import { I18nProvider } from "../i18n/provider";
import type { ReactNode } from "react";
import { DataSidebar } from "../../components/shell/data-sidebar";
import { ExplorerFooter } from "../../components/shell/explorer-footer";
import type { Locale } from "../i18n/types";

export async function renderExplorerLayout(locale: Locale, children: ReactNode) {
  // The root layout's provider holds `common`; this one adds `controls` to it (lib/i18n/provider.tsx).
  const messages = await getMessages(locale, ["controls"]);
  return (
    <I18nProvider locale={locale} messages={messages}>
      <div className="flex min-h-screen flex-col bg-[var(--paper)] min-[900px]:flex-row">
        <DataSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <div id="content" tabIndex={-1} className="flex-1 outline-none">{children}</div>
          <div className="px-5 min-[768px]:px-[34px]">
            <div className="mx-auto max-w-[1180px]"><ExplorerFooter locale={locale} /></div>
          </div>
        </div>
      </div>
    </I18nProvider>
  );
}
