import { allDataPageMetadata, renderAllDataPage } from "../../../../lib/pages/all-data";

export function generateMetadata() { return allDataPageMetadata("en"); }
export default function Page() { return renderAllDataPage("en"); }
