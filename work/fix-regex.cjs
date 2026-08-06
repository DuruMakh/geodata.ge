const fs = require("fs");
const p = "apps/web/lib/data/realRevenue/extractWorkbooks.ts";
let s = fs.readFileSync(p, "utf8");
s = s.replace("replace(/s+/g, \" \" );", "replace(/\\\\s+/g, \" \" );");
s = s.replace("replace(/s+/g, \" \" );", "replace(/\\\\s+/g, \" \" );");
fs.writeFileSync(p, s, "utf8");
