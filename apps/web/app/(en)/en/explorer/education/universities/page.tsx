import { educationTopicMetadata, renderEducationTopicPage } from "../../../../../../lib/pages/education";
export const generateMetadata = () => educationTopicMetadata("en", "universities");
export default function Page() { return renderEducationTopicPage("en", "universities"); }
