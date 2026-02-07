from pathlib import Path
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.sprints import SprintAnswerSubmit


@pytest.mark.parametrize("input_method", ["typed", "click", "voice"])
def test_sprint_answer_submit_accepts_supported_input_methods(
    input_method: str,
) -> None:
    model = SprintAnswerSubmit(
        sprint_id="00000000-0000-0000-0000-000000000000",
        question_id="00000000-0000-0000-0000-000000000000",
        answer="hello",
        input_method=input_method,
    )
    assert model.input_method == input_method


@pytest.mark.parametrize("input_method", ["text", "mouse", "", "TYPE"])
def test_sprint_answer_submit_rejects_unsupported_input_methods(
    input_method: str,
) -> None:
    with pytest.raises(ValidationError):
        SprintAnswerSubmit(
            sprint_id="00000000-0000-0000-0000-000000000000",
            question_id="00000000-0000-0000-0000-000000000000",
            answer="hello",
            input_method=input_method,
        )
