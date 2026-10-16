import { businessPageMetadata, renderBusinessPage } from "../../../../../../lib/pages/business";
export const generateMetadata = () => businessPageMetadata("en", "jobs");
export default function Page() { return renderBusinessPage("en", "jobs"); }
