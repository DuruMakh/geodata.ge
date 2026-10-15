import { externalPositionMetadata, renderExternalPositionPage } from "../../../../../lib/pages/external";
export const generateMetadata = () => externalPositionMetadata("ka", "reserves");
export default function Page() { return renderExternalPositionPage("ka", "reserves"); }
