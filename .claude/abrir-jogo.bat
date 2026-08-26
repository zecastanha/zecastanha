@echo off
title Ze Castanha - Jogo (Gambiarra Game)
cd /d "%~dp0.."

netstat -ano | findstr ":8765" | findstr "LISTENING" >nul
if errorlevel 1 (
    echo Iniciando servidor local...
    start "Ze Castanha - Servidor" /min cmd /c "npx --yes serve -l 8765 ."
    timeout /t 3 /nobreak >nul
)

start "" "http://localhost:8765/jogo/"
