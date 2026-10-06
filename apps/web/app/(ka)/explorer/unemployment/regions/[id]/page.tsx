import { unemploymentRegionPageMetadata, unemploymentRegionStaticParams, renderUnemploymentRegionPage } from "../../../../../../lib/pages/unemployment-regions";
export const dynamicParams = false;
export const generateStaticParams = unemploymentRegionStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return unemploymentRegionPageMetadata((await params).id, "ka"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderUnemploymentRegionPage((await params).id, "ka"); }
