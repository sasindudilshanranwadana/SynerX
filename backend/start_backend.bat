@echo off
REM Windows batch file for starting backend with virtual environment

REM Check if we're in a virtual environment
if defined VIRTUAL_ENV (
    echo ✅ Virtual environment already activated: %VIRTUAL_ENV%
) else (
    REM Try to activate virtual environment
    if exist "venv\Scripts\activate.bat" (
        echo 🔄 Activating virtual environment...
        call venv\Scripts\activate.bat
    ) else (
        echo ⚠️  No virtual environment found. Make sure to create one first:
        echo    python -m venv venv
        echo    venv\Scripts\activate
        echo    pip install -r requirements.txt
        pause
        exit /b 1
    )
)

REM Start the backend server
echo 🚀 Starting backend server...
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
