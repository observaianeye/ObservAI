@echo off
REM ObservAI - MiVOLO Setup Script (Windows)
REM Windows equivalent of setup_mivolo.sh

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "MODELS_DIR=%SCRIPT_DIR%models"
set "MIVOLO_DIR=%SCRIPT_DIR%mivolo_repo"

echo ===================================================
echo  ObservAI: MiVOLO Demographics Setup (Windows)
echo ===================================================
echo.

REM Check Git
where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git not found. Please install Git for Windows from https://git-scm.com
    pause
    exit /b 1
)

REM 1. Clone MiVOLO Repository
echo [1/3] Checking MiVOLO repository...
if not exist "%MIVOLO_DIR%" (
    echo       Cloning MiVOLO repository...
    git clone https://github.com/WildChlamydia/MiVOLO.git "%MIVOLO_DIR%"
    if errorlevel 1 (
        echo ERROR: Failed to clone MiVOLO repository.
        echo Please check your internet connection and try again.
        pause
        exit /b 1
    )
    echo       OK: MiVOLO repository cloned to %MIVOLO_DIR%
) else (
    echo       OK: MiVOLO repository already exists, skipping clone.
)

REM 2. Create Models Directory
echo [2/3] Creating models directory...
if not exist "%MODELS_DIR%" mkdir "%MODELS_DIR%"
echo       OK: Models directory ready at %MODELS_DIR%

REM 3. Model weights download instructions
echo [3/3] Model weights...
echo.
if exist "%MODELS_DIR%\mivolo_model.pth" (
    echo       OK: Model file found at %MODELS_DIR%\mivolo_model.pth
    echo       MiVOLO is ready to use.
) else (
    echo       NOTE: MiVOLO model weights must be downloaded manually.
    echo       MiVOLO models are hosted on Google Drive due to file size.
    echo.
    echo       Steps:
    echo         1. Visit: https://github.com/WildChlamydia/MiVOLO#models
    echo         2. Download a model file (e.g. model_im1k.pth.tar)
    echo         3. Place it in: %MODELS_DIR%\
    echo         4. Rename it to: mivolo_model.pth
    echo.
    echo       OR set the MIVOLO_MODEL_PATH environment variable to your model path.
    echo.
    echo       Without the model file, ObservAI will fall back to InsightFace
    echo       for demographics (which works fine with onnxruntime-gpu + CUDA).
)

echo.
echo ===================================================
echo  Setup complete.
echo  MiVOLO repo: %MIVOLO_DIR%
echo  Models dir:  %MODELS_DIR%
echo ===================================================
echo.
pause
