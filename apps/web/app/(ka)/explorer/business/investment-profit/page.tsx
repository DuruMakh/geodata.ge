import { businessPageMetadata, renderBusinessPage } from "../../../../../lib/pages/business";
export const generateMetadata = () => businessPageMetadata("ka", "investment-profit");
export default function Page() { return renderBusinessPage("ka", "investment-profit"); }
