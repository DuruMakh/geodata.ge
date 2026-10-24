import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("en", "borrowers");
export default function Page() { return renderMoneyBanksPage("en", "borrowers"); }
