"""Text extraction services for PDF and PPTX files."""

import logging
from io import BytesIO

from pypdf import PdfReader
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

from app.observability.langfuse import observe

logger = logging.getLogger(__name__)


def sanitize_text(text: str) -> str:
    """
    Sanitize text by removing null characters and problematic unicode.

    Args:
        text: The raw text to sanitize.

    Returns:
        Cleaned text with problematic characters removed.
    """
    if not text:
        return text

    # Remove null characters
    text = text.replace('\x00', '')
    text = text.replace('\u0000', '')

    # Remove other control characters except newlines (\n), tabs (\t), and carriage returns (\r)
    # Control characters are in range 0x00-0x1F and 0x7F
    cleaned_chars = []
    for char in text:
        code = ord(char)
        # Allow printable characters (32-126), extended Unicode, newlines (10), tabs (9), carriage returns (13)
        if code >= 32 or code in (9, 10, 13):
            cleaned_chars.append(char)
        # Skip other control characters (including null 0x00)

    return ''.join(cleaned_chars)


@observe(
    name="text_extraction.pdf_pages",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def extract_pdf_pages(file_bytes: bytes) -> tuple[list[dict], int]:
    """
    Extract text from a PDF, one unit per page.

    Returns:
        ([{"text": str, "metadata": {"page": n}}], page_count) with 1-based page
        numbers. A page with no text yields no unit; later pages keep their own
        numbers. Returns ([], 0) if extraction fails.
    """
    try:
        reader = PdfReader(BytesIO(file_bytes))
        units = []
        for page_number, page in enumerate(reader.pages, 1):
            text = sanitize_text(page.extract_text() or "").strip()
            if text:
                units.append({"text": text, "metadata": {"page": page_number}})
        page_count = len(reader.pages)
        logger.info(f"Extracted {len(units)} text pages of {page_count} from PDF")
        return units, page_count
    except Exception as e:
        logger.error(f"Failed to extract text from PDF: {e}")
        return [], 0


@observe(
    name="text_extraction.pdf",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def extract_text_from_pdf(file_bytes: bytes) -> tuple[str, int]:
    """
    Extract text from a PDF file.

    Returns:
        A tuple of (full_text, page_count). Returns empty string and 0 if extraction fails.
    """
    units, page_count = extract_pdf_pages(file_bytes)
    return "\n".join(unit["text"] for unit in units), page_count


def _table_lines(table) -> list[str]:
    """Render a table row-wise, pairing each cell with its header cell."""
    rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
    if not rows:
        return []
    header, body = rows[0], rows[1:]
    if not body:
        return [" | ".join(cell for cell in header if cell)] if any(header) else []
    lines = []
    for row in body:
        pairs = [
            f"{name}: {value}" if name else value
            for name, value in zip(header, row)
            if value
        ]
        if pairs:
            lines.append("; ".join(pairs))
    return lines


def _shape_lines(shape) -> list[str]:
    """Text of one shape: text frames, table cells, and grouped shapes."""
    if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
        return [line for child in shape.shapes for line in _shape_lines(child)]
    if getattr(shape, "has_table", False):
        return _table_lines(shape.table)
    if getattr(shape, "has_text_frame", False):
        return [p.text.strip() for p in shape.text_frame.paragraphs if p.text.strip()]
    return []


@observe(
    name="text_extraction.pptx_slides",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def extract_pptx_slides(file_bytes: bytes) -> tuple[list[dict], int]:
    """
    Extract text from a PowerPoint file, one unit per slide.

    Each unit holds the slide title, body text, table cells (row-wise as
    `header: value` pairs), text inside grouped shapes, and speaker notes
    (`Notes: ...`).

    Returns:
        ([{"text": str, "metadata": {"slide": n}}], slide_count) with 1-based
        slide numbers. A slide with no text yields no unit. Returns ([], 0)
        if extraction fails.
    """
    try:
        presentation = Presentation(BytesIO(file_bytes))
        units = []
        for slide_number, slide in enumerate(presentation.slides, 1):
            title = slide.shapes.title
            lines = _shape_lines(title) if title is not None else []
            for shape in slide.shapes:
                if title is None or shape.shape_id != title.shape_id:
                    lines.extend(_shape_lines(shape))
            if slide.has_notes_slide:
                notes = slide.notes_slide.notes_text_frame.text.strip()
                if notes:
                    lines.append(f"Notes: {notes}")
            text = sanitize_text("\n".join(lines)).strip()
            if text:
                units.append({"text": text, "metadata": {"slide": slide_number}})
        slide_count = len(presentation.slides)
        logger.info(f"Extracted {len(units)} text slides of {slide_count} from PPTX")
        return units, slide_count
    except Exception as e:
        logger.error(f"Failed to extract text from PPTX: {e}")
        return [], 0


@observe(
    name="text_extraction.pptx",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def extract_text_from_pptx(file_bytes: bytes) -> tuple[str, int]:
    """
    Extract text from a PowerPoint file.

    Returns:
        A tuple of (full_text, slide_count). Returns empty string and 0 if extraction fails.
    """
    units, slide_count = extract_pptx_slides(file_bytes)
    return "\n\n".join(unit["text"] for unit in units), slide_count
