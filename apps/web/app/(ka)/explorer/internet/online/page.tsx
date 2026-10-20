import { internetPageMetadata, renderInternetPage } from "../../../../../lib/pages/internet";
export const generateMetadata = () => internetPageMetadata("ka", "online");
export default function Page() { return renderInternetPage("ka", "online"); }
