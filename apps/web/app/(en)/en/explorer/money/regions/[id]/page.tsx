import { moneyBanksAreaPageMetadata, moneyBanksAreaStaticParams } from "../../../../../../../lib/pages/money-banks-regions-shared";
import { renderMoneyBanksAreaPage } from "../../../../../../../lib/pages/money-banks-area";
export const dynamicParams = false;
export const generateStaticParams = moneyBanksAreaStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return moneyBanksAreaPageMetadata((await params).id, "en"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderMoneyBanksAreaPage("en", (await params).id); }
