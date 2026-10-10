import { wagesPageMetadata, renderWagesPage } from "../../../../../lib/pages/wages";
export const generateMetadata = () => wagesPageMetadata("ka", "overview");
export default function Page() { return renderWagesPage("ka", "overview"); }
