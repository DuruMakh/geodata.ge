import { tradeHubMetadata, renderTradeHub } from "../../../../../lib/pages/hubs/trade";
export const generateMetadata = () => tradeHubMetadata("en");
export default function Page() { return renderTradeHub("en"); }
