import { wagesRegionPageMetadata, wagesRegionStaticParams, renderWagesRegionPage } from "../../../../../../lib/pages/wages";
export const dynamicParams = false;
export const generateStaticParams = wagesRegionStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return wagesRegionPageMetadata((await params).id, "ka"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderWagesRegionPage((await params).id, "ka"); }
