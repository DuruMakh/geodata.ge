import { regionalEconomiesPageMetadata, renderRegionalEconomiesPage } from "../../../../../../lib/pages/regional-economy";

export const generateMetadata = () => regionalEconomiesPageMetadata("en");
export default function Page() { return renderRegionalEconomiesPage("en"); }
