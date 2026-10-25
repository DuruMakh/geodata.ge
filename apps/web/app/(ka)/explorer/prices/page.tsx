import { groupPageMetadata, renderGroupPage } from "../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("prices", "ka");
export default function Page() { return renderGroupPage("prices", "ka"); }
