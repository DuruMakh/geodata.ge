import { externalPositionMetadata, renderExternalPositionPage } from "../../../../../../lib/pages/external";
export const generateMetadata = () => externalPositionMetadata("en", "reserves");
export default function Page() { return renderExternalPositionPage("en", "reserves"); }
