#!/usr/bin/env python3
"""
Run all ytmusicapi tests and generate a rich summary + JSON report.
Usage: python ytmusic_tests/run_all.py
"""
import subprocess
import sys
import json
from pathlib import Path

def main():
    report_path = Path(__file__).parent / "report.json"
    cmd = [
        sys.executable, "-m", "pytest",
        str(Path(__file__).parent),
        "-v", "--tb=short",
        f"--json-report",
        f"--json-report-file={report_path}",
    ]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(Path(__file__).parent.parent))

    if report_path.exists():
        with open(report_path) as f:
            report = json.load(f)
        tests = report.get("tests", [])
        passed = sum(1 for t in tests if t["outcome"] == "passed")
        failed = sum(1 for t in tests if t["outcome"] == "failed")
        skipped = sum(1 for t in tests if t["outcome"] == "skipped")
        print(f"\n{'='*60}")
        print(f"TOTAL: {len(tests)} | PASS: {passed} | FAIL: {failed} | SKIP: {skipped}")
        print(f"Report saved to: {report_path}")
    
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
