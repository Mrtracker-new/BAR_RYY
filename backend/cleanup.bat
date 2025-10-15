@echo off
echo ========================================
echo  BAR Web - Cleanup Script
echo ========================================
echo.
echo This will remove all uploaded and generated files.
echo Files in uploads/ and generated/ directories only.
echo.
pause

echo Cleaning uploads directory...
for %%f in (uploads\*) do (
    if not "%%~nxf"==".gitkeep" del /Q "%%f" 2>nul
)

echo Cleaning generated directory...
for %%f in (generated\*) do (
    if not "%%~nxf"==".gitkeep" del /Q "%%f" 2>nul
)

echo.
echo ========================================
echo  Cleanup Complete!
echo ========================================
echo.
echo Uploaded and generated files removed.
echo .gitkeep files preserved.
echo.
pause
