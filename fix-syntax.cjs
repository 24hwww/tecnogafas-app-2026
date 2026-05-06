const fs = require("node:fs");
const filePath =
	"/home/soporte24hwww/Documentos/GitHub/tecnogafas-app-2026/src/AppContext.tsx";

// Read the file
let content = fs.readFileSync(filePath, "utf8");

// Fix the missing closing brace
content = content.replace("  return context;\n}", "  return context;\n}\n}");

// Write back to file
fs.writeFileSync(filePath, content);

console.log("✅ Fixed syntax error in AppContext.tsx");
