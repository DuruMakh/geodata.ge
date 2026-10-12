import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("ka", "bank-health");
export default function Page() { return renderMoneyBanksPage("ka", "bank-health"); }
