@echo off
rem Desinstalador do RetroEmulator: fica na pasta do programa como Desinstalar.cmd.
rem Mensagens sem acento de proposito (ver install.cmd).
setlocal
title Desinstalar o RetroEmulator
set "DEST=%~dp0"
set "DEST=%DEST:~0,-1%"

if not exist "%DEST%\RetroEmulator.exe" (
  echo  Esta pasta nao parece ser a do RetroEmulator. Nada foi removido.
  pause
  exit /b 1
)

echo.
choice /C SN /M " Remover o RetroEmulator deste computador"
if errorlevel 2 exit /b 0

tasklist /FI "IMAGENAME eq RetroEmulator.exe" 2>nul | find /I "RetroEmulator.exe" >nul
if not errorlevel 1 (
  echo  O RetroEmulator esta aberto. Feche o programa e tente de novo.
  pause
  exit /b 1
)

choice /C SN /M " Apagar tambem os emuladores baixados, os saves e as configuracoes"
set "WIPE_DATA=%errorlevel%"

powershell -NoProfile -Command "foreach ($p in 'Desktop', 'Programs') { Remove-Item (Join-Path ([Environment]::GetFolderPath($p)) 'RetroEmulator.lnk') -ErrorAction SilentlyContinue }"
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\RetroEmulator" /f >nul 2>&1

rem Este script esta dentro da pasta que vai ser apagada, entao a limpeza roda de uma copia no TEMP
set "CLEANUP=%TEMP%\retroemulator-remover.cmd"
> "%CLEANUP%" echo @echo off
>> "%CLEANUP%" echo ping -n 3 127.0.0.1 ^>nul
if "%WIPE_DATA%"=="1" (
  >> "%CLEANUP%" echo rd /s /q "%DEST%"
) else (
  >> "%CLEANUP%" echo for /d %%%%D in ^("%DEST%\*"^) do if /I not "%%%%~nxD"=="data" rd /s /q "%%%%D"
  >> "%CLEANUP%" echo del /q "%DEST%\*"
)
>> "%CLEANUP%" echo del "%%~f0"

echo.
echo  O RetroEmulator foi removido.
if not "%WIPE_DATA%"=="1" echo  Seus saves e emuladores continuam em: %DEST%\data
echo.
pause
cd /d "%TEMP%"
start "" /min cmd /c "%CLEANUP%"
exit /b 0
