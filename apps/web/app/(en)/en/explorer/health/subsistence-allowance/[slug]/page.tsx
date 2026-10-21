import { renderSocialPlacePage, socialMunicipalityParams, socialPlaceMetadata } from "../../../../../../../lib/pages/social-places";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return socialMunicipalityParams(); }
export async function generateMetadata({ params }: Props) { return socialPlaceMetadata({ kind: "municipality", slug: (await params).slug }, "en", "subsistence-allowance"); }
export default async function Page({ params }: Props) { return renderSocialPlacePage({ kind: "municipality", slug: (await params).slug }, "en", "subsistence-allowance"); }
