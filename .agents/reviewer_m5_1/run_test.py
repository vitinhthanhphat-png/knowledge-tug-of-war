import os
import sys
from pathlib import Path

# Print diagnostics
print("Current Working Directory:", os.getcwd())
print("Files in CWD:", os.listdir("."))

# Run verify-m5.py and print stdout/stderr
import subprocess
print("\nRunning verify-m5.py...")
result = subprocess.run(
    [sys.executable, "tests/verify-m5.py"],
    cwd=r"d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war",
    capture_output=True,
    text=True,
    encoding="utf-8"
)
print("Return Code:", result.returncode)
print("Stdout:\n", result.stdout)
print("Stderr:\n", result.stderr)

# Check if m5_verification_summary.json exists and print it
summary_path = r"d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\tests\m5_verification_summary.json"
if os.path.exists(summary_path):
    with open(summary_path, "r", encoding="utf-8") as f:
        print("\nSummary Content:\n", f.read())
else:
    print("\nSummary not found!")
