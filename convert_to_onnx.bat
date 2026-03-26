@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo =========================================================
echo    CONVERT PhoBERT 540MB -^> ONNX (INT8) CHO BROWSER
echo =========================================================

IF EXIST venv\Scripts\activate.bat (
    echo --- Dang kich hoat moi truong ao (venv)...
    call venv\Scripts\activate.bat
) ELSE (
    echo --- Khong tim thay thu muc venv, co the pip se cai vao Python goc cua ban.
)

echo [1/2] Cai dat cac thu vien Optimum, ONNX Runtime...
pip install -r requirements-onnx.txt

echo [2/2] Chay Optimum-CLI de Export, Optimize (O1) va Quantize...
echo Chuong trinh se tu dong tao va luu folder vao: extension\models\phobert_toxic
optimum-cli export onnx --model . --task text-classification --optimize O1 --quantize dynamic .\extension\models\phobert_toxic\

echo =========================================================
echo DONE! QUAN TRONG QUAN TRONG: BAN CAN GIT COMMIT NGAY folder "extension/models" VUA TAO ROI DAY NGUOC LAI MAY MAC DE LAM TIEP.
echo =========================================================

pause
