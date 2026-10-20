import { transportAreaPageMetadata, transportAreaStaticParams } from "../../../../../../../lib/pages/transport-shared";
import { renderTransportAreaPage } from "../../../../../../../lib/pages/transport-area";
export const dynamicParams = false;
export const generateStaticParams = transportAreaStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return transportAreaPageMetadata((await params).id, "en"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderTransportAreaPage("en", (await params).id); }
