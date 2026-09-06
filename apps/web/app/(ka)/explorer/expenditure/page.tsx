import { renderExpenditurePage, expenditurePageMetadata } from "../../../../lib/pages/expenditure";

export const generateMetadata = () => expenditurePageMetadata("ka");
export default function Page() { return renderExpenditurePage("ka"); }
