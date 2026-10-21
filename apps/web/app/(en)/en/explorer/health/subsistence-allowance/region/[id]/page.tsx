import { renderSocialPlacePage, socialPlaceMetadata, socialRegionParams } from "../../../../../../../../lib/pages/social-places";

type Props = { params: Promise<{ id: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return socialRegionParams(); }
export async function generateMetadata({ params }: Props) { return socialPlaceMetadata({ kind: "region", id: (await params).id }, "en", "subsistence-allowance"); }
export default async function Page({ params }: Props) { return renderSocialPlacePage({ kind: "region", id: (await params).id }, "en", "subsistence-allowance"); }
