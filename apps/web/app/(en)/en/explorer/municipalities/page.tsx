import { renderMunicipalIndex, municipalPageMetadata } from "../../../../../lib/pages/municipal";

export function generateMetadata() { return municipalPageMetadata("index", null, "en"); }
export default function Page() { return renderMunicipalIndex("en"); }
