import { householdRegionPageMetadata, householdRegionStaticParams, renderHouseholdRegionPage } from "../../../../../../../../lib/pages/household";
export const dynamicParams = false;
export const generateStaticParams = householdRegionStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return householdRegionPageMetadata("spending", (await params).id, "en"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderHouseholdRegionPage("spending", (await params).id, "en"); }
