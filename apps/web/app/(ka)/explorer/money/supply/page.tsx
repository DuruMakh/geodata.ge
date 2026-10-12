import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("ka", "supply");
export default function Page() { return renderMoneyBanksPage("ka", "supply"); }
