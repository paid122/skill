@echo off
REM AUREUS QUANT launcher for Windows. Double-click this file.
cd /d "%~dp0"
echo AUREUS QUANT launcher - checking Python...
set PY=
where py >nul 2>nul && set PY=py -3
if "%PY%"=="" ( where python >nul 2>nul && set PY=python )
if "%PY%"=="" (
  echo Python 3.10 or newer is required. Install it from https://www.python.org/downloads/windows/
  echo IMPORTANT: tick "Add python.exe to PATH" in the installer, then run this again.
  pause & exit /b 1
)
%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" || (
  echo Your Python is older than 3.10. Install a newer one from https://www.python.org/downloads/windows/
  pause & exit /b 1
)
if not exist .venv (
  echo First run: creating a private Python environment - one time, about 2 minutes...
  %PY% -m venv .venv || ( pause & exit /b 1 )
)
call .venv\Scripts\activate.bat
echo Checking / installing packages (first run downloads several hundred MB - progress shown below)...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt || ( echo Package install failed. & pause & exit /b 1 )
if "%PORT%"=="" set PORT=8001
echo.
echo AUREUS QUANT is starting on http://localhost:%PORT%  - keep this window open (close it to stop).
start "" cmd /c "timeout /t 4 >nul & start http://localhost:%PORT%"
python -m uvicorn aureus.api.app:app --port %PORT%
pause
