import { tradeOverviewMetadata, renderTradeOverviewPage } from "../../../../../../lib/pages/trade";
export const generateMetadata = () => tradeOverviewMetadata("en");
export default function Page() { return renderTradeOverviewPage("en"); }
