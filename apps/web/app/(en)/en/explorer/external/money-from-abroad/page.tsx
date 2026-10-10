import { moneyFromAbroadMetadata, renderMoneyFromAbroadPage } from "../../../../../../lib/pages/external";
export const generateMetadata = () => moneyFromAbroadMetadata("en");
export default function Page() { return renderMoneyFromAbroadPage("en"); }
