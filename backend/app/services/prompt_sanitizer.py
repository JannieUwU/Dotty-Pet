"""
Security layer for user-supplied personality prompts.

Detection — three passes:
  Pass 1 — REJECT (injection): regex patterns for prompt injection / jailbreak.
  Pass 2 — REJECT (lexicon):   hit-test against bundled sensitive-word lexicons.
  Pass 3 — STRIP:              remove suspicious markup (HTML, code fences, JSON).

Lexicon directory: app/services/lexicon/
Each file is one term per line, UTF-8.  Files are grouped by script type so the
correct matching strategy is applied:

  ASCII / Latin-script files  → word-boundary regex  (\b...\b, case-insensitive)
      en.txt, lang_de.txt, lang_es.txt, lang_fr.txt,
      lang_hi.txt (romanised), lang_ru.txt (romanised), lang_tr.txt

  CJK / non-Latin-script files → substring match (no word boundaries in CJK)
      pornography_zh.txt, pornography_categories_zh.txt,
      political_zh.txt, anti_revolutionary_zh.txt,
      violence_zh.txt, weapons_zh.txt,
      zh_supplement.txt, zh_gfw.txt, zh_corruption.txt,
      zh_misc_supplement.txt, zh_miscellaneous.txt,
      zh_new_ideology.txt, zh_livelihood.txt,
      lang_ja.txt, lang_ko.txt, lang_ar.txt, lang_th.txt

  Mixed files (contain both Latin and CJK) → split and route each term
      (handled automatically by _is_latin_term)
"""

import re
import unicodedata
import logging
from dataclasses import dataclass
from pathlib import Path

from app.config import PERSONALITY_MAX_CHARS

log = logging.getLogger(__name__)

MAX_CHARS = PERSONALITY_MAX_CHARS

# ── Input normalisation ────────────────────────────────────────────────────────
# Applied before any pattern matching to defeat Unicode homoglyph and
# zero-width character bypass attempts (e.g. ｉｇｎｏｒｅ → ignore).

_ZERO_WIDTH_RE = re.compile(
    r"[\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]"
)


def _normalize(text: str) -> str:
    """NFKC-normalise and strip zero-width / invisible characters."""
    text = unicodedata.normalize("NFKC", text)
    text = _ZERO_WIDTH_RE.sub("", text)
    return text


# ── Helpers ────────────────────────────────────────────────────────────────────

# A term is treated as "Latin / word-boundary safe" when it contains only
# ASCII letters, digits, spaces, hyphens, apostrophes, and common accented
# Latin characters (covers EN, DE, ES, FR, TR, romanised HI/RU).
_LATIN_RE = re.compile(
    r"^[A-Za-z0-9 '\-àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ"
    r"ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß"
    r"şŞğĞıİçÇöÖüÜ]+$"  # Turkish extras
)


def _is_latin_term(term: str) -> bool:
    return bool(_LATIN_RE.match(term))


# ── Lexicon configuration ──────────────────────────────────────────────────────

_LEXICON_DIR = Path(__file__).parent / "lexicon"

# (filename_stem, category, user_message)
_LEXICON_CONFIG: list[tuple[str, str, str]] = [
    # English
    ("en",                        "profanity",  "Profanity or offensive language is not allowed."),
    # European languages
    ("lang_de",                   "profanity",  "Profanity or offensive language is not allowed."),
    ("lang_es",                   "profanity",  "Profanity or offensive language is not allowed."),
    ("lang_fr",                   "profanity",  "Profanity or offensive language is not allowed."),
    ("lang_tr",                   "profanity",  "Profanity or offensive language is not allowed."),
    # South / Central Asian (romanised)
    ("lang_hi",                   "profanity",  "Profanity or offensive language is not allowed."),
    ("lang_ru",                   "profanity",  "Profanity or offensive language is not allowed."),
    # Script-based languages (substring match)
    ("lang_ar",                   "profanity",  "Profanity or offensive language is not allowed."),
    ("lang_ja",                   "profanity",  "Profanity or offensive language is not allowed."),
    ("lang_ko",                   "profanity",  "Profanity or offensive language is not allowed."),
    ("lang_th",                   "profanity",  "Profanity or offensive language is not allowed."),
    # Chinese — sexual
    ("pornography_zh",            "sexual",     "Sexual or adult content is not allowed."),
    ("pornography_categories_zh", "sexual",     "Sexual or adult content is not allowed."),
    ("zh_supplement",             "sexual",     "Sexual or adult content is not allowed."),
    # Chinese — political
    ("political_zh",              "political",  "Politically sensitive content is not allowed."),
    ("anti_revolutionary_zh",     "political",  "Politically sensitive content is not allowed."),
    ("zh_gfw",                    "political",  "Politically sensitive content is not allowed."),
    ("zh_new_ideology",           "political",  "Politically sensitive content is not allowed."),
    ("zh_corruption",             "political",  "Politically sensitive content is not allowed."),
    # Chinese — violence / weapons
    ("violence_zh",               "violence",   "Violent or terrorist content is not allowed."),
    ("weapons_zh",                "violence",   "Weapons or explosives content is not allowed."),
    # Chinese — misc sensitive
    ("zh_livelihood",             "sensitive",  "Sensitive social content is not allowed."),
    ("zh_miscellaneous",          "sensitive",  "Sensitive content is not allowed."),
    ("zh_misc_supplement",        "sensitive",  "Sensitive content is not allowed."),
]


def _load_terms(path: Path) -> list[str]:
    """Load a word-per-line file, skip blanks and comments."""
    try:
        raw = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        return [ln.strip() for ln in raw if ln.strip() and not ln.startswith("#")]
    except Exception as exc:
        log.warning("[sanitizer] Cannot load %s: %s", path.name, exc)
        return []


# ── Build compiled lexicon structures ─────────────────────────────────────────
#
# For each lexicon we produce:
#   word_re   — single compiled regex for Latin terms  (None if no Latin terms)
#   substrings — list of lowercased non-Latin terms for substring search
#
# This is done once at import time.

@dataclass
class _CompiledLexicon:
    word_re: re.Pattern | None
    substrings: list[str]
    category: str
    message: str


_COMPILED: list[_CompiledLexicon] = []

for _stem, _cat, _msg in _LEXICON_CONFIG:
    _path = _LEXICON_DIR / f"{_stem}.txt"
    _terms = _load_terms(_path)
    if not _terms:
        continue

    _latin: list[str] = []
    _subs:  list[str] = []

    for _t in _terms:
        if _is_latin_term(_t):
            _latin.append(_t)
        else:
            _subs.append(_t.lower())

    _word_re = None
    if _latin:
        # Build one big alternation — much faster than looping
        _escaped = [re.escape(t) for t in _latin]
        _word_re = re.compile(
            r"\b(?:" + "|".join(_escaped) + r")\b",
            re.IGNORECASE,
        )

    _COMPILED.append(_CompiledLexicon(
        word_re=_word_re,
        substrings=_subs,
        category=_cat,
        message=_msg,
    ))
    log.debug(
        "[sanitizer] %s: %d latin-word terms, %d substring terms",
        _stem, len(_latin), len(_subs),
    )


def _lexicon_hit(text: str) -> tuple[str, str] | None:
    """
    Return (category, message) for the first lexicon hit, or None if clean.
    Checks word-boundary regex first (O(n) single pass), then substrings.
    """
    text_lower = text.lower()
    for lex in _COMPILED:
        if lex.word_re and lex.word_re.search(text):
            return lex.category, lex.message
        for sub in lex.substrings:
            if sub in text_lower:
                return lex.category, lex.message
    return None


# ── Pass 1: Prompt injection / jailbreak (regex) ──────────────────────────────

_INJECTION_PATTERNS: list[tuple[str, str]] = [
    (r"ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?",
     "Prompt injection attempt detected."),
    (r"disregard\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?",
     "Prompt injection attempt detected."),
    (r"forget\s+(everything|all|your|the)\s+(rules?|instructions?|guidelines?|constraints?|prompt)",
     "Prompt injection attempt detected."),
    (r"new\s+instructions?\s*:",
     "Prompt injection attempt detected."),
    (r"you\s+are\s+now\s+(?:an?\s+)?(?:unrestricted|jailbreak|dan|evil|uncensored|unfiltered)",
     "Jailbreak attempt detected."),
    (r"(?:pretend|imagine|roleplay|simulate|act)\s+(?:you\s+are|being|as)\s+"
     r"(?:an?\s+)?(?:ai\s+without|unrestricted|jailbreak)",
     "Jailbreak attempt detected."),
    (r"\bdan\s*(?:mode|prompt)?\b",
     "Jailbreak attempt detected."),
    (r"\bdeveloper\s+mode\b",
     "Jailbreak attempt detected."),
    (r"no\s+(?:restrictions?|limits?|filters?|rules?|guidelines?|constraints?|safety)",
     "Jailbreak attempt detected."),
    (r"without\s+(?:any\s+)?(?:restrictions?|limits?|filters?|rules?|guidelines?|constraints?)",
     "Jailbreak attempt detected."),
    (r"(?:system\s*prompt|hidden\s*instruction|internal\s*rule|base\s*prompt)",
     "System prompt manipulation detected."),
    (r"(?:reveal|show|print|output|leak|expose)\s+(?:your\s+)?"
     r"(?:system|hidden|internal|base)\s+(?:prompt|instruction)",
     "System prompt manipulation detected."),
    (r"<\s*/?system\s*>",
     "System prompt manipulation detected."),
    (r"\[INST\]|\[\/INST\]",
     "System prompt manipulation detected."),
    (r"(?:rm\s+-rf|exec\s*\(|eval\s*\(|subprocess|os\.system|__import__|shell\s*=\s*True)",
     "Code execution attempt detected."),
    (r"(?:import\s+os|import\s+sys|import\s+subprocess)",
     "Code execution attempt detected."),
    (r"(?:output|print|reveal|show|leak|expose)\s+(?:all\s+)?(?:user\s+)?"
     r"(?:data|password|secret|token|api.?key|credential)",
     "Data exfiltration attempt detected."),
    (r"(?:bypass|override|disable|circumvent|break)\s+"
     r"(?:safety|filter|rule|guideline|restriction|moderation)",
     "Safety bypass attempt detected."),
]

_INJECTION_RE = [(re.compile(p, re.IGNORECASE), msg) for p, msg in _INJECTION_PATTERNS]

# ── Pass 3: Strip suspicious markup ───────────────────────────────────────────

_STRIP_RE = [re.compile(p, re.IGNORECASE | re.DOTALL) for p in [
    r"```[\s\S]{0,2000}?```",
    r"`[^`\n]{0,300}`",
    r"<[^>]{1,200}>",
    r"\{[^}]{0,500}\}",
]]

# ── Result type ────────────────────────────────────────────────────────────────

@dataclass
class SanitizeResult:
    ok: bool
    cleaned: str = ""
    reason: str | None = None
    category: str | None = None


# ── Main entry point ───────────────────────────────────────────────────────────

def sanitize_personality(raw: str) -> SanitizeResult:
    """
    Validate and clean a user-supplied personality prompt.

    Returns SanitizeResult(ok=True, cleaned=...) on success,
    or SanitizeResult(ok=False, reason=..., category=...) on failure.
    """
    if not raw or not raw.strip():
        return SanitizeResult(ok=False, reason="Prompt cannot be empty.", category="empty")

    # Normalise before any checks — defeats homoglyph / zero-width bypasses
    raw = _normalize(raw)

    if len(raw) > MAX_CHARS:
        return SanitizeResult(
            ok=False,
            reason=f"Prompt is too long ({len(raw)} chars). Maximum is {MAX_CHARS} characters.",
            category="length",
        )

    text = raw.strip()

    # Pass 1 — injection / jailbreak
    for rx, msg in _INJECTION_RE:
        if rx.search(text):
            return SanitizeResult(ok=False, reason=msg, category="injection")

    # Pass 2 — lexicon content policy
    hit = _lexicon_hit(text)
    if hit:
        cat, msg = hit
        return SanitizeResult(ok=False, reason=msg, category=cat)

    # Pass 3 — strip markup
    for rx in _STRIP_RE:
        text = rx.sub(" ", text)

    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    if not text:
        return SanitizeResult(ok=False, reason="Prompt is empty after sanitization.", category="empty")

    return SanitizeResult(ok=True, cleaned=text)
