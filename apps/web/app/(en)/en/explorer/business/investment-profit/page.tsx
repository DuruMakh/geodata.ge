import { businessPageMetadata, renderBusinessPage } from "../../../../../../lib/pages/business";
export const generateMetadata = () => businessPageMetadata("en", "investment-profit");
export default function Page() { return renderBusinessPage("en", "investment-profit"); }
