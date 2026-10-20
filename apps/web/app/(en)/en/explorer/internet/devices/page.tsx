import { internetPageMetadata, renderInternetPage } from "../../../../../../lib/pages/internet";
export const generateMetadata = () => internetPageMetadata("en", "devices");
export default function Page() { return renderInternetPage("en", "devices"); }
