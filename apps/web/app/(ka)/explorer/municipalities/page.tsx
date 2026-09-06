import { renderMunicipalIndex, municipalPageMetadata } from "../../../../lib/pages/municipal";

export function generateMetadata() { return municipalPageMetadata("index", null, "ka"); }
export default function Page() { return renderMunicipalIndex("ka"); }
