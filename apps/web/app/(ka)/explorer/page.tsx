import { renderHubPage, hubPageMetadata } from "../../../lib/pages/hub";

export function generateMetadata() { return hubPageMetadata("ka"); }
export default function Page() { return renderHubPage("ka"); }
