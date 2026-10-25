import { groupPageMetadata, renderGroupPage } from "../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("external", "ka");
export default function Page() { return renderGroupPage("external", "ka"); }
