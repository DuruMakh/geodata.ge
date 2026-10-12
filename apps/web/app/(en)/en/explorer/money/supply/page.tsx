import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("en", "supply");
export default function Page() { return renderMoneyBanksPage("en", "supply"); }
