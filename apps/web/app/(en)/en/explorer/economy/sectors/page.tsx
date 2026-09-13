import { economicSectorsPageMetadata, renderEconomicSectorsPage } from "../../../../../../lib/pages/economic-sectors";
export const generateMetadata = () => economicSectorsPageMetadata("en");
export default function Page() { return renderEconomicSectorsPage("en"); }
