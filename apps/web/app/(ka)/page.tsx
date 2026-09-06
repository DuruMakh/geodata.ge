import { renderHomePage, homePageMetadata } from "../../lib/pages/home";

export function generateMetadata() { return homePageMetadata("ka"); }
export default function Page() { return renderHomePage("ka"); }
