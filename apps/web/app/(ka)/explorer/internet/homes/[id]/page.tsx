import { internetAreaPageMetadata, internetAreaStaticParams } from "../../../../../../lib/pages/internet-shared";
import { renderInternetAreaPage } from "../../../../../../lib/pages/internet-area";
export const dynamicParams = false;
export const generateStaticParams = internetAreaStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return internetAreaPageMetadata((await params).id, "ka"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderInternetAreaPage("ka", (await params).id); }
