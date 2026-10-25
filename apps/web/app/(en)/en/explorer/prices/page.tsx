import { groupPageMetadata, renderGroupPage } from "../../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("prices", "en");
export default function Page() { return renderGroupPage("prices", "en"); }
