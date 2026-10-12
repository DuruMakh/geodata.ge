import { tradeProductsMetadata, renderTradeProductsPage } from "../../../../../../lib/pages/trade";
export const generateMetadata = () => tradeProductsMetadata("en");
export default function Page() { return renderTradeProductsPage("en"); }
