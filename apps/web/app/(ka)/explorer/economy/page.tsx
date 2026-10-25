import { groupPageMetadata, renderGroupPage } from "../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("economy", "ka");
export default function Page() { return renderGroupPage("economy", "ka"); }
