import { tradeServicesMetadata, renderTradeServicesPage } from "../../../../../../lib/pages/trade";
export const generateMetadata = () => tradeServicesMetadata("en");
export default function Page() { return renderTradeServicesPage("en"); }
