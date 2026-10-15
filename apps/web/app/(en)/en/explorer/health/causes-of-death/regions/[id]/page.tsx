import { healthDeathsAreaPageMetadata, healthDeathsAreaStaticParams, renderHealthDeathsAreaPage } from "../../../../../../../../lib/pages/health-deaths";
export const dynamicParams = false;
export const generateStaticParams = healthDeathsAreaStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return healthDeathsAreaPageMetadata("en", (await params).id); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderHealthDeathsAreaPage("en", (await params).id); }
