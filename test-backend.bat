@echo off
REM Quick test to verify the backend is running and accepting connections
echo Testing backend connection...
curl -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
echo.
echo.
echo If you see a token above, the backend is working correctly!
echo Open website.html in your browser and try logging in with:
echo   Username: admin
echo   Password: admin123
pause