"""
matching/merchants/normalise.py

Text normalisation shared by merchant matching - turns both a merchant
dictionary key and a real transaction description into the same
comparable form regardless of apostrophes, punctuation, or case.
"""


def normalise_for_matching(text):
    """Lowercase and strip everything except letters/digits/spaces, so both
    a merchant dictionary key and a real transaction description normalise
    to the same comparable form regardless of apostrophes, punctuation, or
    case. e.g. "Sainsbury's" and "SAINSBURYS S MKTS )))" both become
    sequences of plain lowercase words that can be safely substring-matched.

    Apostrophes are REMOVED entirely (not turned into spaces/word breaks).
    Real bank descriptions render an apostrophe inconsistently - sometimes
    dropped ("SAINSBURYS"), sometimes rendered as a literal space
    ("DOMINO S PIZZA", from "Domino's Pizza") - so two things happen:
        1. Apostrophes in the input are removed before any other processing,
            so "Sainsbury's" -> "sainsburys" (one word, no gap).
        2. A standalone single-letter "word" left over after splitting on
            whitespace gets MERGED INTO the word right before it (not just
            deleted) - this is almost always the leftover "s" from a bank
            rendering an apostrophe-s as a literal space rather than dropping
            it. "domino s pizza" must become "dominos pizza" (glued back
            together), not "domino pizza" (which would no longer contain
            "dominos" as a substring at all).
    """
    text = text.replace("'", "").replace("\u2019", "")  # straight and curly apostrophes
    cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in text)
    raw_words = cleaned.lower().split()

    words = []
    for word in raw_words:
        if len(word) == 1 and words:
            words[-1] = words[-1] + word
        else:
            words.append(word)
    return " ".join(words)