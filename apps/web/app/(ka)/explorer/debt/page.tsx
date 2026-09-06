import { renderDebtPage, debtPageMetadata } from "../../../../lib/pages/debt";

export function generateMetadata() { return debtPageMetadata("ka"); }
export default function Page() { return renderDebtPage("ka"); }
