"""Teams Activity + Adaptive Card builders (PR 078, review/26 §2).

Plain JSON dicts — no SDK. The confirm token rides in each Action.Submit ``data``.
"""

from __future__ import annotations

ADAPTIVE_CARD_CONTENT_TYPE = "application/vnd.microsoft.card.adaptive"


def text_activity(text: str) -> dict:
    return {"type": "message", "text": text}


def _card_attachment(card: dict) -> dict:
    return {"contentType": ADAPTIVE_CARD_CONTENT_TYPE, "content": card}


def confirm_card_activity(*, text: str, token: str) -> dict:
    """A message with a Confirm/Cancel Adaptive Card. Tapping an action sends a new
    activity whose ``value`` is the button's ``data`` (carrying the one-shot token)."""
    card = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [{"type": "TextBlock", "wrap": True, "text": text}],
        "actions": [
            {
                "type": "Action.Submit",
                "title": "Confirm",
                "data": {"action": "confirm", "token": token},
            },
            {
                "type": "Action.Submit",
                "title": "Cancel",
                "data": {"action": "cancel", "token": token},
            },
        ],
    }
    return {"type": "message", "attachments": [_card_attachment(card)]}


def result_card_activity(text: str) -> dict:
    """A text-only Adaptive Card used to REPLACE a confirm card after it's been handled,
    so the buttons disappear (the one-shot token remains the real double-book guard)."""
    card = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [{"type": "TextBlock", "wrap": True, "text": text}],
    }
    return {"type": "message", "attachments": [_card_attachment(card)]}
