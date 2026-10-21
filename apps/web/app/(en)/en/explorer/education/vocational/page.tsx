import { educationTopicMetadata, renderEducationTopicPage } from "../../../../../../lib/pages/education";
export const generateMetadata = () => educationTopicMetadata("en", "vocational");
export default function Page() { return renderEducationTopicPage("en", "vocational"); }
