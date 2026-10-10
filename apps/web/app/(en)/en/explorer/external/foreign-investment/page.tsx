import { foreignInvestmentMetadata, renderForeignInvestmentPage } from "../../../../../../lib/pages/external";
export const generateMetadata = () => foreignInvestmentMetadata("en");
export default function Page() { return renderForeignInvestmentPage("en"); }
