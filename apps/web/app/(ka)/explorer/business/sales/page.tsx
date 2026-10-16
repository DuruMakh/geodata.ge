import { businessPageMetadata, renderBusinessPage } from "../../../../../lib/pages/business";
export const generateMetadata = () => businessPageMetadata("ka", "sales");
export default function Page() { return renderBusinessPage("ka", "sales"); }
