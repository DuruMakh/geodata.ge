import { wagesPageMetadata, renderWagesPage } from "../../../../../../lib/pages/wages";
export const generateMetadata = () => wagesPageMetadata("en", "regions");
export default function Page() { return renderWagesPage("en", "regions"); }
