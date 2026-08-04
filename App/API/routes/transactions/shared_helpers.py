"""
routes/transactions/shared_helpers.py

Small, stateless helpers shared across the transactions package's
submodules. Currently only upload.py uses these, but kept separate
from that file specifically so crud.py or categorization_routes.py
can reuse them later without needing to import "the upload file" for
an unrelated helper.
"""

MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB - a bank export has no
# business being bigger than this; a basic safety cap against
# accidental or malicious oversized uploads.

CSV_FORMULA_TRIGGER_CHARS = ('=', '+', '-', '@', '\t', '\r')


def sanitize_cell(value):
    """Strip a leading formula-injection trigger character from a cell
    before it's stored/displayed. A description or date field starting
    with '=', '+', '-', or '@' can be interpreted as a formula by
    spreadsheet software (Excel, Sheets) if this data is ever exported
    or opened there - legitimate bank transaction text never starts
    with these, so stripping is safe. Only applied to the values we
    store/display, never to the dedup key, so matching against
    previously-stored transactions is unaffected.
    """
    v = value
    while v and v[0] in CSV_FORMULA_TRIGGER_CHARS:
        v = v[1:].strip()
    return v