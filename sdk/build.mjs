/**
 * Build du SDK FaceAuth avec esbuild.
 * Produit deux bundles :
 *   - dist/faceauth.js      (IIFE — utilisable via <script> classique)
 *   - dist/faceauth.esm.js  (ESM — utilisable via import)
 * Les déclarations TypeScript (.d.ts) sont générées séparément via `tsc`.
 */
import * as esbuild from "esbuild";
import { execSync } from "node:child_process";

const watch = process.argv.includes("--watch");

const sharedConfig = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  sourcemap: true,
  minify: !watch,
  target: ["es2020"],
  loader: { ".ts": "ts" },
};

async function build() {
  // Bundle IIFE — pour <script src="...">
  const iifeCtx = await esbuild.context({
    ...sharedConfig,
    format: "iife",
    globalName: "FaceAuth",
    outfile: "dist/faceauth.js",
  });

  // Bundle ESM — pour import { FaceAuth } from '@faceauth/sdk'
  const esmCtx = await esbuild.context({
    ...sharedConfig,
    format: "esm",
    outfile: "dist/faceauth.esm.js",
  });

  if (watch) {
    await iifeCtx.watch();
    await esmCtx.watch();
    console.log("👀  Mode watch actif — en attente de modifications...");
  } else {
    await iifeCtx.rebuild();
    await esmCtx.rebuild();
    await iifeCtx.dispose();
    await esmCtx.dispose();

    console.log("✅  Bundles JS générés (dist/faceauth.js, dist/faceauth.esm.js)");

    // Génération des types .d.ts via tsc
    try {
      execSync("npx tsc --emitDeclarationOnly", { stdio: "inherit" });
      console.log("✅  Déclarations TypeScript générées (dist/*.d.ts)");
    } catch (e) {
      console.error("⚠️  Erreur lors de la génération des types :", e.message);
    }
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
