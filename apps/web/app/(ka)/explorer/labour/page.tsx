import { groupPageMetadata, renderGroupPage } from "../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("labour", "ka");
export default function Page() { return renderGroupPage("labour", "ka"); }
