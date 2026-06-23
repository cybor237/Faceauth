/***
 * Usage :
 *   npm run build        (génère dist/faceauth.js d'abord)
 *   node scripts/inline-demo.mjs
 *
 * Résultat : examples/vanilla/index.standalone.html
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const bundlePath = join(root, "dist", "faceauth.js");
const htmlPath = join(root, "examples", "vanilla", "index.html");
const outPath = join(root, "examples", "vanilla", "index.standalone.html");

if (!existsSync(bundlePath)) {
  console.error("❌  dist/faceauth.js introuvable — lancez `npm run build` d'abord");
  process.exit(1);
}

const bundleCode = readFileSync(bundlePath, "utf-8");
const html = readFileSync(htmlPath, "utf-8");

const inlinedHtml = html.replace(
  '<script src="../../dist/faceauth.js"></script>',
  `<script>\n${bundleCode}\n</script>`
);

writeFileSync(outPath, inlinedHtml, "utf-8");
console.log(`✅  Démo autonome générée : examples/vanilla/index.standalone.html`);