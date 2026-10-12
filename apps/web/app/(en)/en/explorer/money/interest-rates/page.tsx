import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("en", "interest-rates");
export default function Page() { return renderMoneyBanksPage("en", "interest-rates"); }
