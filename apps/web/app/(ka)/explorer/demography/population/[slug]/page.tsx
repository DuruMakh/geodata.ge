import { populationMunicipalityParams, populationPlaceMetadata, renderPopulationPlacePage } from "../../../../../../lib/pages/demography-population-place";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return populationMunicipalityParams(); }
export async function generateMetadata({ params }: Props) { return populationPlaceMetadata({ kind: "municipality", slug: (await params).slug }, "ka"); }
export default async function Page({ params }: Props) { return renderPopulationPlacePage({ kind: "municipality", slug: (await params).slug }, "ka"); }
