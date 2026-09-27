@echo off
chcp 65001 >nul
title CSU Pixel Campus
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，请安装 Node.js 24 后重新双击此脚本。
  pause
  exit /b 1
)
node "%~dp0tools\start-campus.mjs" %*
set "campusExitCode=%errorlevel%"
if not "%campusExitCode%"=="0" pause
exit /b %campusExitCode%
