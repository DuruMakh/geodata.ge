import { tradeDomesticMetadata, renderTradeDomesticPage } from "../../../../../../lib/pages/trade";
export const generateMetadata = () => tradeDomesticMetadata("en");
export default function Page() { return renderTradeDomesticPage("en"); }
