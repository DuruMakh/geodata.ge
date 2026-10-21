import { businessAreaPageMetadata, businessAreaStaticParams, renderBusinessAreaPage } from "../../../../../../lib/pages/business-regions";
export const dynamicParams = false;
export const generateStaticParams = businessAreaStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return businessAreaPageMetadata((await params).id, "ka"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderBusinessAreaPage("ka", (await params).id); }
