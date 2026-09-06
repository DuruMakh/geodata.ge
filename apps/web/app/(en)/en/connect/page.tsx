import { renderConnectPage, connectPageMetadata } from "../../../../lib/pages/connect";

export function generateMetadata() { return connectPageMetadata("en"); }
export default function Page() { return renderConnectPage("en"); }
