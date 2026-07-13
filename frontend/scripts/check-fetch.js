import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, "../src");

let failed = false;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      const content = fs.readFileSync(fullPath, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        // Regex to catch: fetch('/api...'), fetch("/api..."), fetch(`/api...`)
        if (/fetch\(\s*['"`]\/?api\//.test(line)) {
          console.error(`\x1b[31m[ERROR] Raw relative fetch call detected in ${path.relative(srcDir, fullPath)}:${idx + 1}\x1b[0m`);
          console.error(`  Line: ${line.trim()}`);
          console.error(`  Please route API requests through the Axios client in 'api/backend.ts' instead.\n`);
          failed = true;
        }
      });
    }
  }
}

console.log("Checking for raw relative fetch calls in frontend/src...");
scanDir(srcDir);

if (failed) {
  process.exit(1);
} else {
  console.log("\x1b[32m✔ No raw relative fetch calls found.\x1b[0m");
  process.exit(0);
}
