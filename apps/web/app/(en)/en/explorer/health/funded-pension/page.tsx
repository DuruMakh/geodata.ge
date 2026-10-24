import { renderSocialTopicPage, socialTopicMetadata } from "../../../../../../lib/pages/social";
export const generateMetadata = () => socialTopicMetadata("en", "funded-pension");
export default function Page() { return renderSocialTopicPage("en", "funded-pension"); }
