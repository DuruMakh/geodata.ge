import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("ka", "interest-rates");
export default function Page() { return renderMoneyBanksPage("ka", "interest-rates"); }
