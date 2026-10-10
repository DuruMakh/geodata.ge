import { tradeDomesticMetadata, renderTradeDomesticPage } from "../../../../../lib/pages/trade";
export const generateMetadata = () => tradeDomesticMetadata("ka");
export default function Page() { return renderTradeDomesticPage("ka"); }
