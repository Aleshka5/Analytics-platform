"""Resolve the request language for generated sentences and error text."""


class LanguageRejected(Exception):
    """The explicit lang value is not exactly 'ru' or 'en'."""


def resolve_lang(lang: str | None, accept_language: str | None) -> str:
    """Return 'ru' or 'en'.

    An explicit lang must be exactly one of those two strings. When lang is
    omitted, the first supported tag in Accept-Language wins. Tags are read
    left to right and are not reordered by q. A tag is supported when its
    primary subtag is ru or en (ru-RU counts as ru). Otherwise the result is en.
    """

    if lang is not None:
        if lang in ("ru", "en"):
            return lang
        raise LanguageRejected
    if not accept_language:
        return "en"
    for part in accept_language.split(","):
        tag = part.split(";", 1)[0].strip().lower()
        if not tag or tag == "*":
            continue
        primary = tag.split("-", 1)[0]
        if primary in ("ru", "en"):
            return primary
    return "en"
