import { housingAreaPageMetadata, housingAreaStaticParams } from "../../../../../../lib/pages/housing-shared";
import { renderHousingAreaPage } from "../../../../../../lib/pages/housing-area";
export const dynamicParams = false;
export const generateStaticParams = housingAreaStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return housingAreaPageMetadata((await params).id, "ka"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderHousingAreaPage("ka", (await params).id); }
