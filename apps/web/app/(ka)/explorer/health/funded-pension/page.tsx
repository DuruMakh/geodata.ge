import { renderSocialTopicPage, socialTopicMetadata } from "../../../../../lib/pages/social";
export const generateMetadata = () => socialTopicMetadata("ka", "funded-pension");
export default function Page() { return renderSocialTopicPage("ka", "funded-pension"); }
