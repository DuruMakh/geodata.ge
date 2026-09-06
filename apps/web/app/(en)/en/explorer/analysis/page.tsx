import { analysisPageMetadata, renderAnalysisPage } from "../../../../../lib/pages/analysis";

export function generateMetadata() { return analysisPageMetadata("en"); }
export default function AnalysisPage() { return renderAnalysisPage("en"); }
