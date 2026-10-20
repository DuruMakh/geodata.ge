import { museumsIndexMetadata } from "../../../../../../lib/pages/science-culture-shared";
import { renderMuseumsIndexPage } from "../../../../../../lib/pages/science-culture-museums";
export const generateMetadata = () => museumsIndexMetadata("en");
export default function Page() { return renderMuseumsIndexPage("en"); }
