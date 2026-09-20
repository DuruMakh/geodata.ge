import {
  regionalEconomyPageMetadata,
  regionalEconomyStaticParams,
  renderRegionalEconomyPage,
} from "../../../../../../lib/pages/regional-economy";

export const dynamicParams = false;
export const generateStaticParams = regionalEconomyStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return regionalEconomyPageMetadata((await params).id, "ka");
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return renderRegionalEconomyPage((await params).id, "ka");
}
