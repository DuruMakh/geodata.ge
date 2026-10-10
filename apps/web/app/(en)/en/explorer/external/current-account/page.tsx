import { currentAccountMetadata, renderCurrentAccountPage } from "../../../../../../lib/pages/external";
export const generateMetadata = () => currentAccountMetadata("en");
export default function Page() { return renderCurrentAccountPage("en"); }
