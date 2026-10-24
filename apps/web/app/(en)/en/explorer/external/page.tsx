import { groupPageMetadata, renderGroupPage } from "../../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("external", "en");
export default function Page() { return renderGroupPage("external", "en"); }
