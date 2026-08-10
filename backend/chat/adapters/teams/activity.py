"""Teams activity → normalized identity + command (PR 078, review/26 §4, §5).

The identity is keyed the SAME way everywhere: ``from.aadObjectId`` when present, else
``from.id`` (fallback) — never mixed for one user silently. A user linked under an
aadObjectId whose later activity lacks it is keyed by the fallback id → resolves as a
DIFFERENT (unlinked) identity → the glue's "not linked" path handles it gracefully
(reviewer's §4 consistency requirement).
"""

from __future__ import annotations


def teams_identity(activity: dict) -> tuple[str, str]:
    """Return ``(external_user_id, external_team_id)`` from a Teams activity.

    external_user_id = ``from.aadObjectId`` (stable AAD object id) or ``from.id``.
    external_team_id = ``channelData.tenant.id`` (AAD tenant id) — tenant scoping.
    """
    frm = activity.get("from") or {}
    external_user_id = frm.get("aadObjectId") or frm.get("id") or ""
    tenant = ((activity.get("channelData") or {}).get("tenant")) or {}
    external_team_id = tenant.get("id") or ""
    return external_user_id, external_team_id


def strip_bot_mention(text: str) -> str:
    """Strip a leading ``<at>Bot</at>`` mention if present (defensive — personal scope
    has no mention). Also collapses surrounding whitespace."""
    if not text:
        return ""
    cleaned = text
    lower = cleaned.lower()
    if "<at>" in lower and "</at>" in lower:
        end = lower.index("</at>") + len("</at>")
        cleaned = cleaned[end:]
    return cleaned.strip()


def submit_value(activity: dict) -> dict | None:
    """The Action.Submit ``value`` (card button data) if this activity is a card submit,
    else None."""
    value = activity.get("value")
    return value if isinstance(value, dict) else None
