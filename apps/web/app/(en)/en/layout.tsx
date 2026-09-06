import type { ReactNode } from "react";
import { RootDocument, rootMetadata } from "../../../components/site/root-document";
import { I18nProvider } from "../../../lib/i18n/provider";
import { getMessages } from "../../../lib/i18n/messages.server";
import "../../globals.css";

export const metadata = rootMetadata("en");

export default async function EnglishLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages("en", ["common"]);
  return <RootDocument locale="en"><I18nProvider locale="en" messages={messages}>{children}</I18nProvider></RootDocument>;
}
