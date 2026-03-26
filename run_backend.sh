#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "==========================================="
echo "   THIẾT LẬP MÔI TRƯỜNG & CHẠY BACKEND   "
echo "==========================================="

if [ ! -d "venv" ]; then
    echo "1. Đang tạo Python Virtual Environment..."
    python3 -m venv venv
else
    echo "1. Virtual Environment đã tồn tại."
fi

echo "2. Kích hoạt Virtual Environment..."
source venv/bin/activate

echo "3. Cài đặt các thư viện cần thiết..."
pip install -r requirements.txt

echo "4. Khởi động API Server..."
python server.py
