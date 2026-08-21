@echo off
title JARVIS 2.0
echo [JARVIS] Sistem baslatiliyor...
cd /d "%~dp0"

if not exist "node_modules" (
    echo [JARVIS] Paketler yukleniyor...
    call npm.cmd install
)

if not exist "dist\index.html" (
    echo [JARVIS] Ilk derleme gerceklestiriliyor...
    call npm.cmd run build
)

set NODE_ENV=production
call .\node_modules\.bin\electron.cmd .
exit
