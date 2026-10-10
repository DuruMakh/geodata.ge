import { wagesPageMetadata, renderWagesPage } from "../../../../../lib/pages/wages";
export const generateMetadata = () => wagesPageMetadata("ka", "regions");
export default function Page() { return renderWagesPage("ka", "regions"); }
