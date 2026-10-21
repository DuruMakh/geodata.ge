import { wagesPageMetadata } from "../../../../../lib/pages/wages-shared";
import { renderWagesRegionsIndexPage } from "../../../../../lib/pages/wages-regions-index";
export const generateMetadata = () => wagesPageMetadata("ka", "regions");
export default function Page() { return renderWagesRegionsIndexPage("ka"); }
