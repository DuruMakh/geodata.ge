import { groupPageMetadata, renderGroupPage } from "../../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("labour", "en");
export default function Page() { return renderGroupPage("labour", "en"); }
