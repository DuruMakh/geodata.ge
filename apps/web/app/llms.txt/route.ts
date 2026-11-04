import { llmsText } from "../../lib/seo/llmsText";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  return new Response(await llmsText(), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
