import { educationHubMetadata, renderEducationHub } from "../../../../lib/pages/education";
export const generateMetadata = () => educationHubMetadata("ka");
export default function Page() { return renderEducationHub("ka"); }
