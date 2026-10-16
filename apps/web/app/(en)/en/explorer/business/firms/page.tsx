import { businessPageMetadata, renderBusinessPage } from "../../../../../../lib/pages/business";
export const generateMetadata = () => businessPageMetadata("en", "firms");
export default function Page() { return renderBusinessPage("en", "firms"); }
