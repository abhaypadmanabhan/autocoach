from pathlib import Path
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.quiz import AnswerSubmit


@pytest.mark.parametrize("input_method", ["typed", "click", "voice"])
def test_answer_submit_accepts_supported_input_methods(input_method: str) -> None:
    model = AnswerSubmit(answer="hello", input_method=input_method)
    assert model.input_method == input_method


@pytest.mark.parametrize("input_method", ["text", "mouse", "", "TYPE"])
def test_answer_submit_rejects_unsupported_input_methods(input_method: str) -> None:
    with pytest.raises(ValidationError):
        AnswerSubmit(answer="hello", input_method=input_method)
