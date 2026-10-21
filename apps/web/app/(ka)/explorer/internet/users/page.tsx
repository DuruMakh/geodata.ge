import { internetPageMetadata, renderInternetPage } from "../../../../../lib/pages/internet";
export const generateMetadata = () => internetPageMetadata("ka", "users");
export default function Page() { return renderInternetPage("ka", "users"); }
