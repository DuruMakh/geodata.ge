import { renderHomePage, homePageMetadata } from "../../../lib/pages/home";

export function generateMetadata() { return homePageMetadata("en"); }
export default function Page() { return renderHomePage("en"); }
