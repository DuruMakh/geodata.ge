import { groupPageMetadata, renderGroupPage } from "../../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("living", "en");
export default function Page() { return renderGroupPage("living", "en"); }
