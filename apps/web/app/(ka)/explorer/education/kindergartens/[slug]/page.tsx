import { educationMunicipalityParams, educationPlaceMetadata, renderEducationPlacePage } from "../../../../../../lib/pages/education-places";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return educationMunicipalityParams(); }
export async function generateMetadata({ params }: Props) { return educationPlaceMetadata({ kind: "municipality", slug: (await params).slug }, "ka", "kindergartens"); }
export default async function Page({ params }: Props) { return renderEducationPlacePage({ kind: "municipality", slug: (await params).slug }, "ka", "kindergartens"); }
