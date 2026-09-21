// Runs every tests/*.test.ts file and reports one overall result. Use: npm test
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const here = new URL(".", import.meta.url);
const files = readdirSync(here).filter((f) => f.endsWith(".test.ts")).sort();
let failed = 0;

for (const file of files) {
  console.log(`\n=== ${file}`);
  const result = spawnSync("npx", ["tsx", `tests/${file}`], { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) failed++;
}

console.log(failed ? `\n${failed} of ${files.length} test files FAILED` : `\nAll ${files.length} test files passed`);
process.exit(failed ? 1 : 0);
