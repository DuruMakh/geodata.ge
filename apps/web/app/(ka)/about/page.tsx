import { renderAboutPage, aboutPageMetadata } from "../../../lib/pages/about";

export function generateMetadata() { return aboutPageMetadata("ka"); }
export default function Page() { return renderAboutPage("ka"); }
