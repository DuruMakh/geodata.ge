import { inflationCityPageMetadata, inflationCityStaticParams, renderInflationCityPage } from "../../../../../../lib/pages/inflation";

export const dynamicParams = false;
export const generateStaticParams = inflationCityStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  return inflationCityPageMetadata((await params).city, "ka");
}
export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  return renderInflationCityPage((await params).city, "ka");
}
