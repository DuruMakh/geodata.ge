import { environmentAreaPageMetadata, renderEnvironmentAreaPage } from "../../../../../../lib/pages/environment-areas";
import { environmentAreaStaticParams } from "../../../../../../lib/pages/environment-shared";
export const dynamicParams = false;
export const generateStaticParams = environmentAreaStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return environmentAreaPageMetadata((await params).id, "ka", "waste"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderEnvironmentAreaPage("ka", "waste", (await params).id); }
