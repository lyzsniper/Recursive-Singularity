@echo off
rem COSMOS one-click launcher (Windows)
rem ES modules cannot run over file://, so we serve this folder over HTTP.
cd /d %~dp0

where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting COSMOS at http://127.0.0.1:8801/  ...  close this window to stop.
  start "" http://127.0.0.1:8801/
  python -m http.server 8801
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting COSMOS at http://127.0.0.1:8801/  ...  close this window to stop.
  start "" http://127.0.0.1:8801/
  py -3 -m http.server 8801
  goto :eof
)

where npx >nul 2>nul
if %errorlevel%==0 (
  echo Starting COSMOS at http://127.0.0.1:8801/  ...  close this window to stop.
  start "" http://127.0.0.1:8801/
  npx -y serve -l 8801 .
  goto :eof
)

echo [ERROR] Python or Node.js not found. Install either one, or run:
echo         python -m http.server 8801 --directory cosmos
pause
