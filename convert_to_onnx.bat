@echo off
cd /d "%~dp0"

echo =========================================================
echo    CONVERT PhoBERT 540MB -^> ONNX INT8 CHO BROWSER
echo =========================================================

IF EXIST venv\Scripts\activate.bat (
    echo --- Dang kich hoat moi truong ao venv ...
    call venv\Scripts\activate.bat
) ELSE (
    echo --- Khong tim thay thu muc venv, co the pip se cai vao Python goc cua ban.
)

echo [1/3] Cai dat cac thu vien Optimum, ONNX Runtime...
pip install -r requirements-onnx.txt

echo [2/3] Chay Optimum-CLI de Export va Optimize O1...
echo Chuong trinh se tao thu muc tam thoi: extension\models\phobert_toxic_temp
optimum-cli export onnx --model . --task text-classification --optimize O1 .\extension\models\phobert_toxic_temp\

echo [3/3] Chay Optimum-CLI de Quantize INT8...
echo Chuong trinh se luu model chinh thuc vao: extension\models\phobert_toxic
optimum-cli onnxruntime quantize --onnx_model .\extension\models\phobert_toxic_temp\ --output .\extension\models\phobert_toxic\ --avx2

echo =========================================================
echo DONE! QUAN TRONG QUAN TRONG: BAN CAN GIT COMMIT NGAY folder extension/models VUA TAO ROI DAY NGUOC LAI MAY MAC DE LAM TIEP.
echo =========================================================

pause
