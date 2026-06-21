#!/usr/bin/env bash
# Start the VIRS service. Run from the virs-service folder.
# First run: python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && python make_fixture.py
set -e
[ -f .venv/bin/activate ] && source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
