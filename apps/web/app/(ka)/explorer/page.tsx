import { allDataPageMetadata, renderAllDataPage } from "../../../lib/pages/all-data";

export function generateMetadata() { return allDataPageMetadata("ka"); }
export default function Page() { return renderAllDataPage("ka"); }
