import { groupPageMetadata, renderGroupPage } from "../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("society", "ka");
export default function Page() { return renderGroupPage("society", "ka"); }
