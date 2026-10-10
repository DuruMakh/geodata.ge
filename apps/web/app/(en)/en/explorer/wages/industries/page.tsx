import { wagesPageMetadata, renderWagesPage } from "../../../../../../lib/pages/wages";
export const generateMetadata = () => wagesPageMetadata("en", "industries");
export default function Page() { return renderWagesPage("en", "industries"); }
