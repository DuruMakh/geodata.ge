import { internetPageMetadata, renderInternetPage } from "../../../../../../lib/pages/internet";
export const generateMetadata = () => internetPageMetadata("en", "users");
export default function Page() { return renderInternetPage("en", "users"); }
