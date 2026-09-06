import { renderSocialImage } from "../../../../lib/seo/socialImage";

export const dynamic = "force-static";

export async function GET() {
  return renderSocialImage("en");
}
