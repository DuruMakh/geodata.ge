import { educationHubMetadata, renderEducationHub } from "../../../../../lib/pages/education";
export const generateMetadata = () => educationHubMetadata("en");
export default function Page() { return renderEducationHub("en"); }
