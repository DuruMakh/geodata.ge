import { renderConnectPage, connectPageMetadata } from "../../../lib/pages/connect";

export function generateMetadata() { return connectPageMetadata("ka"); }
export default function Page() { return renderConnectPage("ka"); }
