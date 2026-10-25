import { groupPageMetadata, renderGroupPage } from "../../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("society", "en");
export default function Page() { return renderGroupPage("society", "en"); }
