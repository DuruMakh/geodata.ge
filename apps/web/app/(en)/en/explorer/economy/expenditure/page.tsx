import { gdpExpenditurePageMetadata, renderGdpExpenditurePage } from "../../../../../../lib/pages/gdp-expenditure";
export const generateMetadata = () => gdpExpenditurePageMetadata("en");
export default function Page() { return renderGdpExpenditurePage("en"); }
