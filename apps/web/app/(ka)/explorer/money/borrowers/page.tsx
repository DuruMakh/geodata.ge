import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("ka", "borrowers");
export default function Page() { return renderMoneyBanksPage("ka", "borrowers"); }
