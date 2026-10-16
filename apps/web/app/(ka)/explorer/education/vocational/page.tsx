import { educationTopicMetadata, renderEducationTopicPage } from "../../../../../lib/pages/education";
export const generateMetadata = () => educationTopicMetadata("ka", "vocational");
export default function Page() { return renderEducationTopicPage("ka", "vocational"); }
