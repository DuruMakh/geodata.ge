import { groupPageMetadata, renderGroupPage } from "../../../../lib/pages/group";
export const generateMetadata = () => groupPageMetadata("demography", "ka");
export default function Page() { return renderGroupPage("demography", "ka"); }
