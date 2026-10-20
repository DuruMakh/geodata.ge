import { renderSocialTopicPage, socialTopicMetadata } from "../../../../../lib/pages/social";
export const generateMetadata = () => socialTopicMetadata("ka", "social-payments");
export default function Page() { return renderSocialTopicPage("ka", "social-payments"); }
