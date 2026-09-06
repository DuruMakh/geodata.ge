import { renderMunicipalRegion, municipalPageMetadata, municipalRegionStaticParams } from "../../../../../../lib/pages/municipal";

type Props = { params: Promise<{ id: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return municipalRegionStaticParams(); }
export async function generateMetadata({ params }: Props) { return municipalPageMetadata("region", (await params).id, "ka"); }
export default async function Page({ params }: Props) { return renderMunicipalRegion((await params).id, "ka"); }
