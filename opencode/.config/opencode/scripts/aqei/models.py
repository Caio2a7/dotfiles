#!/usr/bin/env python3
"""models.py - Domain models, value objects, and constants for AQEI."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Dict, List, Optional, Tuple

# ==============================================================================
# WEIGHTS & BENCHMARK THRESHOLDS
# ==============================================================================

WEIGHT_CSI = 0.20
WEIGHT_TBER = 0.15
WEIGHT_RCP = 0.35
WEIGHT_CPI = 0.15
WEIGHT_DSIR = 0.15

MAX_FILE_LINES = 300
MAX_FUNCTION_LINES = 40

STUB_REGEX = re.compile(
    r"(?i)\b(TODO|FIXME|XXX|HACK)\b|^\s*pass\s*$|\.\.\.add\s+logic|NotImplementedError",
    re.MULTILINE,
)

IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".cache",
    ".aiflow",
}

SOURCE_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".go",
    ".rs",
    ".java",
    ".c",
    ".cpp",
    ".h",
}

# ANSI Colors
CLR_RESET = "\033[0m"
CLR_BOLD = "\033[1m"
CLR_DIM = "\033[2m"
CLR_RED = "\033[31m"
CLR_GREEN = "\033[32m"
CLR_YELLOW = "\033[33m"
CLR_BLUE = "\033[34m"
CLR_MAGENTA = "\033[35m"
CLR_CYAN = "\033[36m"
CLR_WHITE = "\033[37m"
CLR_GOLD = "\033[38;5;220m"


# ==============================================================================
# VALUE OBJECTS & DATA CONTRACTS
# ==============================================================================


@dataclass(frozen=True)
class DimensionScore:
    """Represents the evaluation score and metrics for an AQEI dimension."""

    code: str
    name: str
    weight: float
    score: float
    raw_metrics: Dict[str, Any]
    deductions: List[str]

    @property
    def weighted_contribution(self) -> float:
        return self.weight * self.score


@dataclass(frozen=True)
class AQEIResult:
    """Consolidated AQEI evaluation result with global score and status."""

    global_score: float
    status: str
    dimensions: List[DimensionScore]
    recommendations: List[str]
    session_id: Optional[str] = None
    target_path: Optional[str] = None


@dataclass(frozen=True)
class SessionRawData:
    """Raw telemetry payload extracted from OpenCode database storage."""

    session_id: str
    title: str
    tokens_input: int
    tokens_output: int
    tokens_reasoning: int
    tokens_cache_read: int
    tokens_cache_write: int
    tool_calls: List[Dict[str, Any]]
    messages: List[Dict[str, Any]]
    reasoning_blocks: List[str]


@dataclass(frozen=True)
class AuditViolation:
    """Static audit violation found in a source file."""

    file_path: str
    line_number: int
    violation_type: str
    description: str


@dataclass(frozen=True)
class DirectoryAuditReport:
    """Comprehensive report for a static codebase directory audit."""

    total_files: int
    total_lines: int
    stubs_count: int
    files_over_limit: List[Tuple[str, int]]
    functions_over_limit: List[Tuple[str, str, int]]
    syntax_errors: List[Tuple[str, str]]
    violations: List[AuditViolation]
