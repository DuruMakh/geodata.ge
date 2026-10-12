import { householdRegionPageMetadata, householdRegionStaticParams, renderHouseholdRegionPage } from "../../../../../../../lib/pages/household";
export const dynamicParams = false;
export const generateStaticParams = householdRegionStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return householdRegionPageMetadata("income", (await params).id, "ka"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderHouseholdRegionPage("income", (await params).id, "ka"); }
