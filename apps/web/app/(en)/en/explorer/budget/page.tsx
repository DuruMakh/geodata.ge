import { groupPageMetadata, renderGroupPage } from "../../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("budget", "en");
export default function Page() { return renderGroupPage("budget", "en"); }
