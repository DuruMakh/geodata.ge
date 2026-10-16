import { educationTopicMetadata, renderEducationTopicPage } from "../../../../../lib/pages/education";
export const generateMetadata = () => educationTopicMetadata("ka", "universities");
export default function Page() { return renderEducationTopicPage("ka", "universities"); }
