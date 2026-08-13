@echo off
title JARVIS
echo JARVIS baslatiliyor...
cd /d "%~dp0"
set NODE_ENV=production
call .\node_modules\.bin\electron.cmd .
exit
