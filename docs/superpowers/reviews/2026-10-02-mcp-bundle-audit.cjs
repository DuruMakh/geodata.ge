// Run from repository root, after the integrated Next build. AST source evidence
// is complementary: a trace lists deployable files, not every bundled module.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const app = path.resolve(__dirname, "../../../apps/web");
const tracePath = path.join(app, ".next/server/app/mcp/route.js.nft.json");
const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
const files = trace.files.map(file => path.resolve(path.dirname(tracePath), file));
const relative = file => path.relative(app, file).replaceAll("\\", "/");
const snapshotPath = path.join(app, "lib/factQuery/generated/snapshot.json");
assert(files.includes(snapshotPath), "The MCP trace must include its packaged snapshot");
const forbiddenFiles = files.filter(file => /(?:\/lib\/db\/|\/lib\/data\/servedData|\/lib\/factQuery\/buildSnapshot|\/productIdentity\.(?:ts|js)|\/docs\/Raw Data\/|\/data\/imports\/|\/@prisma\/|\/@modelcontextprotocol\/sdk\/)/.test(file.replaceAll("\\", "/")));
assert.deepEqual(forbiddenFiles, []);
const compiled = [...new Set([path.join(app, ".next/server/app/mcp/route.js"), ...files.filter(file => file.includes(path.join(".next", "server")) && file.endsWith(".js"))])];
const forbiddenCode = [];
const markers = ["loadServedProductData", "loadServedExplorerData", "loadServedMunicipalData", "buildFactQuerySnapshot", "PrismaClient", "DATABASE_URL", "productIdentity.ts"];
for (const file of compiled) {
  const source = fs.readFileSync(file, "utf8");
  for (const marker of markers) if (source.includes(marker)) forbiddenCode.push({ file: relative(file), marker });
}
assert.deepEqual(forbiddenCode, []);
const snapshotBytes = fs.readFileSync(snapshotPath);
const snapshot = JSON.parse(snapshotBytes.toString("utf8"));
assert.equal(snapshot.schemaVersion, "1.5.0");
const report = { auditedAt: new Date().toISOString(), trace: relative(tracePath), tracedFiles: files.length, files: files.map(relative).sort(), snapshot: { path: relative(snapshotPath), bytes: snapshotBytes.length, sha256: crypto.createHash("sha256").update(snapshotBytes).digest("hex"), schemaVersion: snapshot.schemaVersion, dataVersion: snapshot.dataVersion, releaseCommit: snapshot.releaseCommit, generatedAt: snapshot.generatedAt }, compiledFilesInspected: compiled.map(relative).sort(), forbiddenFileMatches: forbiddenFiles, forbiddenCodeMatches: forbiddenCode, markers, boundaries: "NFT inclusion/absence plus inspected route chunks and separate runtime-import AST audit; third-party code may contain generic unrelated capabilities, and this does not certify hosting or database-mirror parity." };
fs.writeFileSync(path.join(__dirname, "2026-10-02-mcp-bundle-audit.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ tracedFiles: files.length, compiledFiles: compiled.length, snapshot: report.snapshot, forbiddenFiles, forbiddenCode }));
