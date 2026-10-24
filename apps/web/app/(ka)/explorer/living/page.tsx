import { groupPageMetadata, renderGroupPage } from "../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("living", "ka");
export default function Page() { return renderGroupPage("living", "ka"); }
