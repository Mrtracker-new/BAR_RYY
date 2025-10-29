#!/bin/bash
cd backend
export PORT=${PORT:-8000}
echo "Starting uvicorn on port $PORT"
uvicorn app:app --host 0.0.0.0 --port $PORT
