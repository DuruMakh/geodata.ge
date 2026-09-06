import { renderAboutPage, aboutPageMetadata } from "../../../../lib/pages/about";

export function generateMetadata() { return aboutPageMetadata("en"); }
export default function Page() { return renderAboutPage("en"); }
