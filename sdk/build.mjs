/**
 * Build du SDK FaceAuth avec esbuild.
 */
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
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
  const iifeCtx = await esbuild.context({
    ...sharedConfig,
    format: "iife",
    globalName: "FaceAuth",
    outfile: "dist/faceauth.js",
  });

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

    try {
      execSync("npx tsc --emitDeclarationOnly", { stdio: "inherit" });
      console.log("✅  Déclarations TypeScript générées (dist/*.d.ts)");
    } catch (e) {
      console.error("⚠️  Erreur lors de la génération des types :", e.message);
    }

    // Copier les sons dans examples/vanilla/sounds/ — servis par FastAPI via /sounds
    const soundsSrc  = join("src", "ui", "sounds");
    const soundsDemo = join("examples", "vanilla", "sounds");
    if (existsSync(soundsSrc)) {
      mkdirSync(soundsDemo, { recursive: true });
      cpSync(soundsSrc, soundsDemo, { recursive: true });
      console.log("✅  Sons copiés dans examples/vanilla/sounds/");
    }
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});