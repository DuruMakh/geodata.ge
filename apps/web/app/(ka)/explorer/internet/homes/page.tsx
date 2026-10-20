import { internetHomesPageMetadata } from "../../../../../lib/pages/internet-shared";
import { renderInternetHomesPage } from "../../../../../lib/pages/internet-homes";
export const generateMetadata = () => internetHomesPageMetadata("ka");
export default function Page() { return renderInternetHomesPage("ka"); }
