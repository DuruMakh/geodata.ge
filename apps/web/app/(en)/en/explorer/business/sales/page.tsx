import { businessPageMetadata, renderBusinessPage } from "../../../../../../lib/pages/business";
export const generateMetadata = () => businessPageMetadata("en", "sales");
export default function Page() { return renderBusinessPage("en", "sales"); }
