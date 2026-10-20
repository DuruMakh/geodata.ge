import { museumsIndexMetadata } from "../../../../../lib/pages/science-culture-shared";
import { renderMuseumsIndexPage } from "../../../../../lib/pages/science-culture-museums";
export const generateMetadata = () => museumsIndexMetadata("ka");
export default function Page() { return renderMuseumsIndexPage("ka"); }
