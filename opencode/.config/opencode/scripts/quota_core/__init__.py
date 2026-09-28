"""quota_core - Modular quota inspection engine for OpenCode."""

from quota_core.sources import fetch_claude_plan_status, fetch_openrouter_quota
from quota_core.detector import classify_model, detect_active_model
from quota_core.formatter import build_report, format_percent, format_reset_time

__all__ = [
    "detect_active_model",
    "classify_model",
    "fetch_claude_plan_status",
    "fetch_openrouter_quota",
    "build_report",
    "format_percent",
    "format_reset_time",
]
