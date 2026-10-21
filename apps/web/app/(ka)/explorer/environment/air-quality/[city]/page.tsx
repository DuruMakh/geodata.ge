import { environmentCityMetadata, renderEnvironmentCityPage } from "../../../../../../lib/pages/environment-air-quality";
import { environmentCityStaticParams } from "../../../../../../lib/pages/environment-shared";
export const dynamicParams = false;
export const generateStaticParams = environmentCityStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) { return environmentCityMetadata((await params).city, "ka"); }
export default async function Page({ params }: { params: Promise<{ city: string }> }) { return renderEnvironmentCityPage("ka", (await params).city); }
