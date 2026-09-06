import { renderMunicipalCountry, municipalPageMetadata } from "../../../../../lib/pages/municipal";

export function generateMetadata() { return municipalPageMetadata("country", null, "ka"); }
export default function Page() { return renderMunicipalCountry("ka"); }
