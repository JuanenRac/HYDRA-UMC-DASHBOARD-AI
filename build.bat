@echo off
REM =============================================================================
REM HYDRA-UMC-DASHBOARD-AI - Build and Compile Script
REM Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
REM GPL-3.0 - see LICENSE
REM =============================================================================
python "%~dp0bump_manifest_version.py"
if errorlevel 1 ( echo VERSION BUMP FAILED. & pause & exit /b 1 )

echo ========================================
echo  HYDRA-UMC-DASHBOARD-AI
echo  Build and Compile Script - installs dependencies, bumps the version and compiles the app
echo  Author: JuanenRac (Electro Hobby 3D)
echo  E-mail: electrohobby3d@gmail.com
echo  License: GPL-3.0 - see LICENSE
echo ========================================
echo.

echo ========================================
echo  Installing dependencies...
echo ========================================
call npm install
call npm install-scripts approve --all

echo ========================================
echo  Running the real test suite (vitest)...
echo ========================================
call npm test
if errorlevel 1 (
  echo.
  echo TESTS FAILED.
  pause
  exit /b 1
)

echo ========================================
echo  Compiling HYDRA-UMC-DASHBOARD-AI (Prod Mode)
echo ========================================
call npm run build
echo.
echo Build complete! Output in dist/
pause
