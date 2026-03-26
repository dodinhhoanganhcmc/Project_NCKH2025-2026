@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ===========================================
echo    THIẾT LẬP MÔI TRƯỜNG ^& CHẠY BACKEND
echo ===========================================

IF NOT EXIST venv (
    echo [1/4] Đang tạo Python Virtual Environment...
    python -m venv venv
) ELSE (
    echo [1/4] Virtual Environment đã tồn tại.
)

echo [2/4] Kích hoạt Virtual Environment...
call venv\Scripts\activate.bat

echo [3/4] Cài đặt các thư viện cần thiết...
pip install -r requirements.txt

echo [4/4] Khởi động API Server...
python server.py

pause
