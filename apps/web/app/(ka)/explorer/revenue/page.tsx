import { renderRevenuePage, revenuePageMetadata } from "../../../../lib/pages/revenue";

export const generateMetadata = () => revenuePageMetadata("ka");
export default function Page() { return renderRevenuePage("ka"); }
