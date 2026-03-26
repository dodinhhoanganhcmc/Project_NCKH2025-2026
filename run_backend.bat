@echo off
cd /d "%~dp0"

echo ===========================================
echo    THIET LAP MOI TRUONG ^& CHAY BACKEND
echo ===========================================

echo [Kiem tra] Phat hien Torch GPU tren he thong...
python -c "import torch; exit(0 if torch.cuda.is_available() else 1)" 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo =^> Da thay Torch GPU tren may! Se ke thua vao Virtual Environment system-site-packages.
    set USE_SYSTEM_PACKAGES=1
) ELSE (
    echo =^> Khong thay Torch GPU. Se tao moi hoan toan.
    set USE_SYSTEM_PACKAGES=0
)

IF NOT EXIST venv (
    echo [1/4] Dang tao Python Virtual Environment...
    IF "%USE_SYSTEM_PACKAGES%"=="1" (
        python -m venv --system-site-packages venv
    ) ELSE (
        python -m venv venv
    )
) ELSE (
    echo [1/4] Virtual Environment da ton tai.
)

echo [2/4] Kich hoat Virtual Environment...
call venv\Scripts\activate

echo [3/4] Cai dat cac thu vien can thiet...
IF "%USE_SYSTEM_PACKAGES%"=="1" (
    echo =^> Phat hien Torch GPU, bo qua cai dat tai file requirements.txt...
    findstr /v /i "torch" requirements.txt | findstr /v /i "extra-index-url" > req_temp.txt
    pip install -r req_temp.txt
    del req_temp.txt
) ELSE (
    pip install -r requirements.txt
)

echo [4/4] Khoi dong API Server...
python server.py

pause
