import { renderRevenuePage, revenuePageMetadata } from "../../../../../lib/pages/revenue";

export const generateMetadata = () => revenuePageMetadata("en");
export default function Page() { return renderRevenuePage("en"); }
