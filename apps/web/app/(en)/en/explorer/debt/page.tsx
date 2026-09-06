import { renderDebtPage, debtPageMetadata } from "../../../../../lib/pages/debt";

export function generateMetadata() { return debtPageMetadata("en"); }
export default function Page() { return renderDebtPage("en"); }
