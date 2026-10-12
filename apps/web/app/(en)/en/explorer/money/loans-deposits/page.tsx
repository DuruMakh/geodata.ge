import { moneyBanksPageMetadata, renderMoneyBanksPage } from "../../../../../../lib/pages/moneyBanks";
export const generateMetadata = () => moneyBanksPageMetadata("en", "loans-deposits");
export default function Page() { return renderMoneyBanksPage("en", "loans-deposits"); }
