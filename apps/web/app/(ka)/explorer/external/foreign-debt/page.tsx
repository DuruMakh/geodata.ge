import { externalPositionMetadata, renderExternalPositionPage } from "../../../../../lib/pages/external";
export const generateMetadata = () => externalPositionMetadata("ka", "foreign-debt");
export default function Page() { return renderExternalPositionPage("ka", "foreign-debt"); }
