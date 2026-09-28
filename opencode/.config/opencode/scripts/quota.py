#!/usr/bin/env python3
"""quota.py - Deterministic quota inspector for OpenCode."""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from quota_core import build_report, detect_active_model


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Deterministic Quota Inspector for OpenCode"
    )
    parser.add_argument(
        "--model", help="Force specific model check instead of auto-detect"
    )
    args = parser.parse_args([a for a in sys.argv[1:] if a.strip()])
    active = detect_active_model()
    print(build_report(active, forced_model=args.model))


if __name__ == "__main__":
    main()
