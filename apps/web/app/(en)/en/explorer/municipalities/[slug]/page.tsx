import { renderMunicipality, municipalPageMetadata, municipalityStaticParams } from "../../../../../../lib/pages/municipal";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return municipalityStaticParams(); }
export async function generateMetadata({ params }: Props) { return municipalPageMetadata("municipality", (await params).slug, "en"); }
export default async function Page({ params }: Props) { return renderMunicipality((await params).slug, "en"); }
