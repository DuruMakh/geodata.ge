import { internetPageMetadata, renderInternetPage } from "../../../../../lib/pages/internet";
export const generateMetadata = () => internetPageMetadata("ka", "devices");
export default function Page() { return renderInternetPage("ka", "devices"); }
