import { businessPageMetadata, renderBusinessPage } from "../../../../../lib/pages/business";
export const generateMetadata = () => businessPageMetadata("ka", "jobs");
export default function Page() { return renderBusinessPage("ka", "jobs"); }
