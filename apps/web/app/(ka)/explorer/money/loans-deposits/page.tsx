import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("ka", "loans-deposits");
export default function Page() { return renderMoneyBanksPage("ka", "loans-deposits"); }
