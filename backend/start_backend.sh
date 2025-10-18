#!/bin/bash

# Cross-platform backend startup script
# Works on Windows (Git Bash), Mac, and Linux

# Check if we're in a virtual environment
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "✅ Virtual environment already activated: $VIRTUAL_ENV"
else
    # Try to activate virtual environment
    if [ -d "venv" ]; then
        echo "🔄 Activating virtual environment..."
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
            # Windows (Git Bash)
            source venv/Scripts/activate
        else
            # Mac/Linux
            source venv/bin/activate
        fi
    else
        echo "⚠️  No virtual environment found. Make sure to create one first:"
        echo "   python -m venv venv"
        echo "   source venv/bin/activate  # or venv\\Scripts\\activate on Windows"
        echo "   pip install -r requirements.txt"
        exit 1
    fi
fi

# Start the backend server
echo "🚀 Starting backend server..."
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
