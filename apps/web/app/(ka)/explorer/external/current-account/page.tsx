import { currentAccountMetadata, renderCurrentAccountPage } from "../../../../../lib/pages/external";
export const generateMetadata = () => currentAccountMetadata("ka");
export default function Page() { return renderCurrentAccountPage("ka"); }
