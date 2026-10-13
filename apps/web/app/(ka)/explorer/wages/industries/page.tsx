import { wagesPageMetadata } from "../../../../../lib/pages/wages-shared";
import { renderWagesPage } from "../../../../../lib/pages/wages";
export const generateMetadata = () => wagesPageMetadata("ka", "industries");
export default function Page() { return renderWagesPage("ka", "industries"); }
