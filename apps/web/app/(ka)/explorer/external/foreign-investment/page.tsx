import { foreignInvestmentMetadata, renderForeignInvestmentPage } from "../../../../../lib/pages/external";
export const generateMetadata = () => foreignInvestmentMetadata("ka");
export default function Page() { return renderForeignInvestmentPage("ka"); }
