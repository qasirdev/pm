@echo off
cd /d "%~dp0\.."

docker compose up --build -d

echo Server starting at http://localhost:8000
