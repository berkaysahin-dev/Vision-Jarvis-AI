@echo off
title JARVIS - TELEFONDAN BAGLAN
echo Starting JARVIS for LAN access...
echo.
echo Lutfen asagida "Network:" yazan IP adresini telefonunuzun tarayicisina yazin.
echo Bilgisayariniz ve telefonunuz ayni Wi-Fi aginda olmalidir.
echo.
cd "%~dp0"
call npm run dev -- --host
pause
