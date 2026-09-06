import { renderMunicipalCountry, municipalPageMetadata } from "../../../../../../lib/pages/municipal";

export function generateMetadata() { return municipalPageMetadata("country", null, "en"); }
export default function Page() { return renderMunicipalCountry("en"); }
