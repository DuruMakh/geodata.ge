const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../../apps/web/node_modules/typescript');
const app = path.resolve(__dirname, '../../../apps/web');
const visited = new Set();
const edges = [];
function walk(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function dependency(specifier) {
    edges.push({ from: path.relative(app, file).replaceAll('\\', '/'), import: specifier });
    if (!specifier.startsWith('.')) return;
    const base = path.resolve(path.dirname(file), specifier);
    const resolved = [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), base + '.json', base].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!resolved) throw new Error('Unresolved ' + specifier + ' from ' + file);
    if (!resolved.endsWith('.json')) walk(resolved);
  }
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every(item => item.isTypeOnly)) continue;
      dependency(statement.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.isTypeOnly) {
      dependency(statement.moduleSpecifier.text);
    }
  }
  function dynamic(node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) dependency(node.arguments[0].text);
    ts.forEachChild(node, dynamic);
  }
  dynamic(source);
}
for (const root of ['lib/mcp/tools.ts', 'lib/mcp/snapshot.ts', 'lib/mcp/result.ts']) walk(path.join(app, root));
const nodes = [...visited].map(file => path.relative(app, file).replaceAll('\\', '/')).sort();
const forbidden = nodes.filter(file => /(?:buildSnapshot|servedData|\/db\/|productIdentity\.ts|\/data\/csv\.ts)/.test(file));
const filesystemEdges = edges.filter(edge => /^(?:node:)?fs/.test(edge.import));
const report = { method: 'TypeScript AST traversal of all project-local runtime import/re-export/dynamic-import edges; type-only imports omitted; third-party packages not traversed.', roots: ['lib/mcp/tools.ts', 'lib/mcp/snapshot.ts', 'lib/mcp/result.ts'], nodeCount: nodes.length, edgeCount: edges.length, nodes, forbidden, filesystemEdges, external: [...new Set(edges.filter(edge => !edge.import.startsWith('.')).map(edge => edge.import))].sort() };
fs.writeFileSync(path.join(__dirname, '2026-10-01-mcp-import-audit.json'), JSON.stringify(report, null, 2) + '\n');
if (forbidden.length || filesystemEdges.length !== 1 || filesystemEdges[0].from !== 'lib/mcp/snapshot.ts') throw new Error('Runtime loader graph violation');
console.log(JSON.stringify({ nodeCount: nodes.length, edgeCount: edges.length, forbidden, filesystemEdges, external: report.external }));
