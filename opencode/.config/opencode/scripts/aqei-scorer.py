#!/usr/bin/env python3
"""aqei-scorer.py - Clean CLI entrypoint for AQEI Scorer & Auditor."""

import os
import sys

# Ensure package directory is in sys.path
sys.path.insert(0, os.path.dirname(__file__))

from aqei.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
