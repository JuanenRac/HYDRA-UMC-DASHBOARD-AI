// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Build-time version bump: scripts/bump-version.mjs
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Identical script to sibling repo HYDRA-UMC-STUDIO's own
// scripts/bump-version.mjs (same stack, same "cuentakilometros" convention -
// see SONNET/5.PLAN_EJECUCION_32_PROYECTOS_NUEVOS.txt) - copied rather than
// reinvented. Runs as the first step of `npm run build` so every real
// production build bumps package.json's own "version" field automatically.
//
// Increment rule ("odometer" in base 10, ecosystem-wide convention):
//   - patch +1
//   - patch > 9  -> patch = 0, minor +1
//   - minor > 9  -> minor = 0, major +1 (cascades the same way, in case a
//                   minor carry pushes major over 9 too)
// Example: 1.0.9 -> 1.1.0 (not 1.0.10). 1.9.9 -> 2.0.0.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(__dirname, "..", "package.json");

const raw = readFileSync(pkgPath, "utf-8");
const pkg = JSON.parse(raw);

const parts = String(pkg.version || "0.0.0").split(".").map(Number);
if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
  throw new Error(`bump-version: unexpected "version" format in package.json: "${pkg.version}"`);
}
let [major, minor, patch] = parts;

patch += 1;
if (patch > 9) {
  patch = 0;
  minor += 1;
}
if (minor > 9) {
  minor = 0;
  major += 1;
}

const nextVersion = `${major}.${minor}.${patch}`;
pkg.version = nextVersion;

// Preserve the file's existing style: 2-space indent, single trailing newline.
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

console.log(`[bump-version] package.json version -> ${nextVersion}`);
