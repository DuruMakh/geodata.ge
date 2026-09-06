import { methodologyPageMetadata, renderMethodologyPage } from "../../../../lib/pages/methodology";

export function generateMetadata() { return methodologyPageMetadata("en"); }
export default function MethodologyPage() { return renderMethodologyPage("en"); }
