import { internetAreaPageMetadata, internetAreaStaticParams } from "../../../../../../../lib/pages/internet-shared";
import { renderInternetAreaPage } from "../../../../../../../lib/pages/internet-area";
export const dynamicParams = false;
export const generateStaticParams = internetAreaStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return internetAreaPageMetadata((await params).id, "en"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderInternetAreaPage("en", (await params).id); }
