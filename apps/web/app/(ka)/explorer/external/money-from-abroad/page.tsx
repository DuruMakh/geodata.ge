import { moneyFromAbroadMetadata, renderMoneyFromAbroadPage } from "../../../../../lib/pages/external";
export const generateMetadata = () => moneyFromAbroadMetadata("ka");
export default function Page() { return renderMoneyFromAbroadPage("ka"); }
