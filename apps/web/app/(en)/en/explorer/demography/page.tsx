import { groupPageMetadata, renderGroupPage } from "../../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("demography", "en");
export default function Page() { return renderGroupPage("demography", "en"); }
