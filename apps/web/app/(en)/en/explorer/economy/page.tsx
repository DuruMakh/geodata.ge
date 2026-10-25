import { groupPageMetadata, renderGroupPage } from "../../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("economy", "en");
export default function Page() { return renderGroupPage("economy", "en"); }
