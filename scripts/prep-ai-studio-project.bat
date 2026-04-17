@echo off
setlocal EnableDelayedExpansion
title Prep Google AI Studio for Android

echo.
echo  Prep Google AI Studio project for Android
echo  -----------------------------------------
echo.

set "PROJECT_NAME="
set "PACKAGE_NAME="

set /p "PROJECT_NAME=Enter project name (e.g. Tile Tycoon): "
set /p "PACKAGE_NAME=Enter package name (e.g. com.example.myapp): "

if "%PROJECT_NAME%"=="" set "PROJECT_NAME=My App"
if "%PACKAGE_NAME%"=="" set "PACKAGE_NAME=com.example.myapp"

echo.
echo Using:
echo   Project name: %PROJECT_NAME%
echo   Package name: %PACKAGE_NAME%
echo.

cd /d "%~dp0.."
if not exist "package.json" (
  echo Error: package.json not found. Run this script from the project root or scripts folder.
  exit /b 1
)

echo [1/6] Clearing README.md...
echo. > README.md

echo [2/6] Installing Capacitor (core, cli, android)...
call npm install @capacitor/core @capacitor/cli @capacitor/android
if errorlevel 1 (
  echo Error: npm install failed.
  exit /b 1
)

echo [3/6] Initializing Capacitor...
call npx cap init "%PROJECT_NAME%" "%PACKAGE_NAME%"
if errorlevel 1 (
  echo Error: cap init failed.
  exit /b 1
)

echo [4/6] Adding Android platform...
call npx cap add android
if errorlevel 1 (
  echo Error: cap add android failed.
  exit /b 1
)

echo [5/6] Updating package.json from template...
for /f "delims=" %%i in ('powershell -NoProfile -Command "('%PROJECT_NAME%').ToLower().Replace(' ', '-')"') do set "PACKAGE_JSON_NAME=%%i"
set "TEMPLATE=%~dp0package.json.template"
if not exist "!TEMPLATE!" (
  echo Error: package.json.template not found at !TEMPLATE!
  exit /b 1
)
set "TEMPLATE_PATH=!TEMPLATE!"
set "PKG_NAME=!PACKAGE_JSON_NAME!"
powershell -NoProfile -Command "$t = [System.IO.File]::ReadAllText($env:TEMPLATE_PATH); $t = $t.Replace('__NAME__', $env:PKG_NAME); [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'package.json'), $t)"
if errorlevel 1 (
  echo Error: Failed to write package.json.
  exit /b 1
)

echo [6/6] Replacing vite.config.ts from template...
set "VITE_TEMPLATE=%~dp0vite.config.ts.template"
if not exist "!VITE_TEMPLATE!" (
  echo Error: vite.config.ts.template not found at !VITE_TEMPLATE!
  exit /b 1
)
copy /y "!VITE_TEMPLATE!" "vite.config.ts" >nul
if errorlevel 1 (
  echo Error: Failed to write vite.config.ts.
  exit /b 1
)

echo.
echo  All set. Next steps:
echo    - npm run dev -> start the development server
echo    - npm run android -> build and run the app on your Android device
echo    - Ask the AI agent to analyze the project and add an Agent.md and a README.md file.
echo.
pause
