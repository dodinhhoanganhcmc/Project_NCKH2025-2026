#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================================="
echo "   CONVERT PhoBERT 540MB -> ONNX (INT8) CHO BROWSER   "
echo "========================================================="

echo "1. Cài đặt các thư viện Optimum, ONNX Runtime..."
pip install -r requirements-onnx.txt

echo "2. Chạy Optimum-CLI để Export, Optimize (O1) và Quantize (dynamic INT8)..."
echo "Chương trình sẽ lưu mô hình sau nén vào mục: extension/models/phobert_toxic"
optimum-cli export onnx --model . --task text-classification --optimize O1 --quantize dynamic ./extension/models/phobert_toxic/

echo "========================================================="
echo "DONE! HÃY KIỂM TRA MỤC extension/models/phobert_toxic"
echo "========================================================="
