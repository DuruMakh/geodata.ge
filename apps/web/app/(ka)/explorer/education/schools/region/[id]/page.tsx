import { educationPlaceMetadata, educationRegionParams, renderEducationPlacePage } from "../../../../../../../lib/pages/education-places";

type Props = { params: Promise<{ id: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return educationRegionParams(); }
export async function generateMetadata({ params }: Props) { return educationPlaceMetadata({ kind: "region", id: (await params).id }, "ka", "schools"); }
export default async function Page({ params }: Props) { return renderEducationPlacePage({ kind: "region", id: (await params).id }, "ka", "schools"); }
