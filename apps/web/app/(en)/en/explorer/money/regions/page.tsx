import { moneyBanksRegionsPageMetadata } from "../../../../../../lib/pages/money-banks-regions-shared";
import { renderMoneyBanksRegionsPage } from "../../../../../../lib/pages/money-banks-regions";
export const generateMetadata = () => moneyBanksRegionsPageMetadata("en");
export default function Page() { return renderMoneyBanksRegionsPage("en"); }
