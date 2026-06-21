# Start the VIRS service (Windows / PowerShell). Run from the virs-service folder.
# First run: py -3.12 -m venv .venv ; .\.venv\Scripts\Activate.ps1 ; pip install -r requirements.txt ; python make_fixture.py
if (Test-Path ".\.venv\Scripts\Activate.ps1") { . .\.venv\Scripts\Activate.ps1 }
python -m uvicorn app.main:app --reload --port 8000
