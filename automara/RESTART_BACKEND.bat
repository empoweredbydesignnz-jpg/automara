@echo off
echo ============================================
echo Restarting Automara Backend
echo ============================================
echo.

docker restart automara-backend

echo.
echo Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo.
echo Showing recent backend logs:
echo ============================================
docker logs automara-backend --tail 50

echo.
echo ============================================
echo Backend restarted!
echo.
echo Now refresh your tickets page in the browser
echo to see the debug output.
echo ============================================
pause
