import { populationPlaceMetadata, populationRegionParams, renderPopulationPlacePage } from "../../../../../../../../lib/pages/demography-population-place";

type Props = { params: Promise<{ id: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return populationRegionParams(); }
export async function generateMetadata({ params }: Props) { return populationPlaceMetadata({ kind: "region", id: (await params).id }, "en"); }
export default async function Page({ params }: Props) { return renderPopulationPlacePage({ kind: "region", id: (await params).id }, "en"); }
