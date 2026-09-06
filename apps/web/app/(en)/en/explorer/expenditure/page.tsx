import { renderExpenditurePage, expenditurePageMetadata } from "../../../../../lib/pages/expenditure";

export const generateMetadata = () => expenditurePageMetadata("en");
export default function Page() { return renderExpenditurePage("en"); }
