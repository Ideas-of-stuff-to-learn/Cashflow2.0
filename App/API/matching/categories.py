"""
matching/categories.py

Loading the list of user-facing category names, for use as the
"allowed categories" list passed to the LLM prompt.
"""


def load_categories(conn) -> list:
    """Returns every user-facing category name, in display order.
    Deliberately does NOT include the MANUALLY CATEGORISE sentinel -
    that's a system state, not a real category a transaction should
    ever actually be assigned to.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM categories ORDER BY display_order")
        return [row[0] for row in cur.fetchall()]