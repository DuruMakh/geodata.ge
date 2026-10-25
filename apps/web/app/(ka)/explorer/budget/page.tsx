import { groupPageMetadata, renderGroupPage } from "../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("budget", "ka");
export default function Page() { return renderGroupPage("budget", "ka"); }
