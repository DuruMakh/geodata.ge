import { businessPageMetadata, renderBusinessPage } from "../../../../../lib/pages/business";
export const generateMetadata = () => businessPageMetadata("ka", "firms");
export default function Page() { return renderBusinessPage("ka", "firms"); }
