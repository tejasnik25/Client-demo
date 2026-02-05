@echo off
echo Starting Trading Service Manager...
python manager.py
if %ERRORLEVEL% NEQ 0 (
    echo "python" command failed. Trying "py"...
    py manager.py
)
pause
