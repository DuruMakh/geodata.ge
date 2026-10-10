import { wagesPageMetadata, renderWagesPage } from "../../../../../lib/pages/wages";
export const generateMetadata = () => wagesPageMetadata("ka", "gender");
export default function Page() { return renderWagesPage("ka", "gender"); }
