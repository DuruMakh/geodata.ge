import { renderSocialTopicPage, socialTopicMetadata } from "../../../../../../lib/pages/social";
export const generateMetadata = () => socialTopicMetadata("en", "social-package");
export default function Page() { return renderSocialTopicPage("en", "social-package"); }
