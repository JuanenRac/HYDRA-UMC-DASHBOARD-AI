#!/bin/bash
# =============================================================================
# HYDRA-UMC-DASHBOARD-AI - Build and Compile Script
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0 - see LICENSE
# =============================================================================
set -euo pipefail
python3 "$(dirname "$0")/bump_manifest_version.py" || exit 1
cd "$(dirname "$0")"

# Keep the window open if this was double-clicked instead of run from an
# already-open terminal - fires on success AND on a `set -e` early exit
# alike, but only prompts when stdin is actually a terminal (never in
# CI/piped/non-interactive runs).
trap '[ -t 0 ] && read -r -p "Press Enter to close..." _' EXIT

echo "========================================"
echo " HYDRA-UMC-DASHBOARD-AI"
echo " Build and Compile Script - installs dependencies, bumps the version and compiles the app"
echo " Author: JuanenRac (Electro Hobby 3D)"
echo " E-mail: electrohobby3d@gmail.com"
echo " License: GPL-3.0 - see LICENSE"
echo "========================================"
echo ""

echo "========================================"
echo " Installing dependencies... "
echo "========================================"
npm install
npm install-scripts approve --all

echo "========================================"
echo " Running the real test suite (vitest)... "
echo "========================================"
npm test

echo "========================================"
echo " Compiling HYDRA-UMC-DASHBOARD-AI (Prod Mode) "
echo "========================================"
npm run build
echo ""
echo "Build complete! Output in dist/"
