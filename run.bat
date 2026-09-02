@echo off
setlocal
title ASCII_DOVE
cd /d "%~dp0"

set "PORT=8777"
if not "%~1"=="" set "PORT=%~1"

echo.
echo   ASCII_DOVE
echo   ----------
echo.

where node >nul 2>nul
if errorlevel 1 goto NONODE

echo   Server : http://localhost:%PORT%
echo   Tests  : http://localhost:%PORT%/tests/test.html
echo.
echo   Close this window to stop the server.
echo.

rem Open the browser from a detached helper so it fires once the server is up,
rem while node keeps this window as its console.
rem No inner quotes here on purpose: cmd /c "... start "" url" terminates the
rem outer quoted string early. An unquoted URL is treated as the target, not
rem as a window title, so this form is safe.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"

node serve.js %PORT%

rem Reached when node exits (port busy, or you closed it).
echo.
echo   Server stopped.
timeout /t 3 /nobreak >nul
goto :EOF

:NONODE
echo   Node.js was not found on PATH, so opening the file directly.
echo.
echo   ASCII_DOVE works this way, but browsers only offer the camera,
echo   screen capture and "copy image" features over http://localhost.
echo   Install Node.js from https://nodejs.org to get those.
echo.
start "" "index.html"
timeout /t 6 /nobreak >nul
goto :EOF
