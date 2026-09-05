import type { ReactNode } from "react";
import { RootDocument, rootMetadata } from "../../components/site/root-document";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import "../globals.css";

export const metadata = rootMetadata("ka");

export default async function GeorgianLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages("ka", ["common"]);
  return <RootDocument locale="ka"><I18nProvider locale="ka" messages={messages}>{children}</I18nProvider></RootDocument>;
}
