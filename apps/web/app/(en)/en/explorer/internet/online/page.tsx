import { internetPageMetadata, renderInternetPage } from "../../../../../../lib/pages/internet";
export const generateMetadata = () => internetPageMetadata("en", "online");
export default function Page() { return renderInternetPage("en", "online"); }
