@echo off
setlocal
cd /d "%~dp0"
echo Installing Zentrid End User dependencies...
call npm.cmd ci
if errorlevel 1 exit /b 1
echo Starting Zentrid End User...
call npm.cmd run start
