"""Shared fixtures + sys.path bootstrap for the eval-harness test suite.

The eval harness lives under ``backend/evals`` and imports siblings as
``evals.*``. Make ``backend/`` importable no matter where pytest is invoked
from (``pytest evals/tests`` from ``backend/`` or
``pytest backend/evals/tests`` from the repo root).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND = Path(__file__).resolve().parents[2]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture
def fixtures_dir() -> Path:
    """Directory of SYNTHETIC, test-only config + tuple fixtures."""
    return FIXTURES_DIR
