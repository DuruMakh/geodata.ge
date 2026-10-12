import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("en", "bank-health");
export default function Page() { return renderMoneyBanksPage("en", "bank-health"); }
