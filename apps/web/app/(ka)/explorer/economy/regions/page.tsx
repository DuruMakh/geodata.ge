import { regionalEconomiesPageMetadata, renderRegionalEconomiesPage } from "../../../../../lib/pages/regional-economy";

export const generateMetadata = () => regionalEconomiesPageMetadata("ka");
export default function Page() { return renderRegionalEconomiesPage("ka"); }
