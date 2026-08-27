#!/bin/bash
# =============================================================================
# HYDRA-UMC-DASHBOARD-AI - Development Server Start Script
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0 - see LICENSE
# =============================================================================

echo "========================================"
echo " HYDRA-UMC-DASHBOARD-AI"
echo " Development Server Start Script - installs dependencies and starts the dev server"
echo " Author: JuanenRac (Electro Hobby 3D)"
echo " E-mail: electrohobby3d@gmail.com"
echo " License: GPL-3.0 - see LICENSE"
echo "========================================"
echo ""

echo "========================================"
echo " Installing dependencies... "
echo "========================================"
npm install

echo "========================================"
echo " Starting HYDRA-UMC-DASHBOARD-AI (Dev Mode) "
echo "========================================"
npm run dev
