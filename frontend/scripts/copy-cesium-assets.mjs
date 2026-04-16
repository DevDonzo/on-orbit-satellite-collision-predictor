import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "node_modules", "cesium", "Build", "Cesium");
const targetRoot = path.join(projectRoot, "public", "cesium");

const assetDirectories = ["Workers", "Assets", "ThirdParty", "Widgets"];

if (!fs.existsSync(sourceRoot)) {
  console.warn("[copy-cesium-assets] Cesium build directory not found yet. Skipping.");
  process.exit(0);
}

fs.mkdirSync(targetRoot, { recursive: true });

for (const directory of assetDirectories) {
  const source = path.join(sourceRoot, directory);
  const target = path.join(targetRoot, directory);
  fs.cpSync(source, target, { recursive: true });
}

console.log("[copy-cesium-assets] Cesium static assets copied to public/cesium.");
