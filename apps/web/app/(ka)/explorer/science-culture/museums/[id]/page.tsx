import { museumAreaMetadata, museumAreaStaticParams } from "../../../../../../lib/pages/science-culture-shared";
import { renderMuseumAreaPage } from "../../../../../../lib/pages/science-culture-museum-area";
export const dynamicParams = false;
export const generateStaticParams = museumAreaStaticParams;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return museumAreaMetadata((await params).id, "ka"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return renderMuseumAreaPage("ka", (await params).id); }
