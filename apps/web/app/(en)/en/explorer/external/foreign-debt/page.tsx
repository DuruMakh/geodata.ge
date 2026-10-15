import { externalPositionMetadata, renderExternalPositionPage } from "../../../../../../lib/pages/external";
export const generateMetadata = () => externalPositionMetadata("en", "foreign-debt");
export default function Page() { return renderExternalPositionPage("en", "foreign-debt"); }
