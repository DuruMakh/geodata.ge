// The /mcp endpoint as a Vercel Node function. vercel.json rewrites /mcp here and sets its duration and bundled files.
export { POST, OPTIONS, GET, DELETE } from "../lib/mcp/handler";
