import { wagesPageMetadata, renderWagesPage } from "../../../../../../lib/pages/wages";
export const generateMetadata = () => wagesPageMetadata("en", "overview");
export default function Page() { return renderWagesPage("en", "overview"); }
