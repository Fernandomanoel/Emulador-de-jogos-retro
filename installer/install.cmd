@echo off
rem Instalador do RetroEmulator: roda de dentro do Setup.exe (IExpress), ao lado de app.7z e 7za.exe.
rem Instala so para o usuario atual, sem pedir administrador. Mensagens sem acento de proposito:
rem o console do Windows 7 troca os acentos conforme a pagina de codigo.
setlocal
title Instalando o RetroEmulator
set "DEST=%LOCALAPPDATA%\Programs\RetroEmulator"
set "UNINSTALL_KEY=HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\RetroEmulator"

echo.
echo  Instalando o RetroEmulator em:
echo    %DEST%
echo.

tasklist /FI "IMAGENAME eq RetroEmulator.exe" 2>nul | find /I "RetroEmulator.exe" >nul
if not errorlevel 1 (
  echo  O RetroEmulator esta aberto. Feche o programa e abra o instalador de novo.
  echo.
  pause
  exit /b 1
)

if not exist "%DEST%" mkdir "%DEST%"

rem Atualizacao: troca os arquivos do programa e preserva a pasta data (emuladores, saves, configuracoes)
for /d %%D in ("%DEST%\*") do if /I not "%%~nxD"=="data" rd /s /q "%%D"
del /q "%DEST%\*" >nul 2>&1

echo  Copiando os arquivos...
"%~dp07za.exe" x "%~dp0app.7z" -o"%DEST%" -y >nul
if errorlevel 1 (
  echo  Nao foi possivel copiar os arquivos. Verifique o espaco em disco e tente de novo.
  echo.
  pause
  exit /b 1
)
copy /y "%~dp0uninstall.cmd" "%DEST%\Desinstalar.cmd" >nul

echo  Criando os atalhos...
powershell -NoProfile -Command "$s = New-Object -ComObject WScript.Shell; foreach ($p in 'Desktop', 'Programs') { $l = $s.CreateShortcut((Join-Path ([Environment]::GetFolderPath($p)) 'RetroEmulator.lnk')); $l.TargetPath = Join-Path $env:DEST 'RetroEmulator.exe'; $l.WorkingDirectory = $env:DEST; $l.Description = 'RetroEmulator'; $l.Save() }"

rem Entrada em "Aplicativos instalados" / "Programas e Recursos"
reg add "%UNINSTALL_KEY%" /v DisplayName /d "RetroEmulator" /f >nul
reg add "%UNINSTALL_KEY%" /v DisplayVersion /d "@VERSION@" /f >nul
reg add "%UNINSTALL_KEY%" /v Publisher /d "Fernando Manoel" /f >nul
reg add "%UNINSTALL_KEY%" /v InstallLocation /d "%DEST%" /f >nul
reg add "%UNINSTALL_KEY%" /v DisplayIcon /d "%DEST%\RetroEmulator.exe" /f >nul
reg add "%UNINSTALL_KEY%" /v UninstallString /d "\"%DEST%\Desinstalar.cmd\"" /f >nul
reg add "%UNINSTALL_KEY%" /v NoModify /t REG_DWORD /d 1 /f >nul
reg add "%UNINSTALL_KEY%" /v NoRepair /t REG_DWORD /d 1 /f >nul

echo.
echo  Pronto. O RetroEmulator foi instalado e tem um atalho na area de trabalho.
start "" "%DEST%\RetroEmulator.exe"
exit /b 0
