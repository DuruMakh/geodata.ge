import { wagesPageMetadata, renderWagesPage } from "../../../../../../lib/pages/wages";
export const generateMetadata = () => wagesPageMetadata("en", "gender");
export default function Page() { return renderWagesPage("en", "gender"); }
