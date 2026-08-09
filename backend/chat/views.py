"""Chat-linking web endpoints (PR 077 Slice 1).

Only the web side of the linking flow lives here. It mirrors the Invitation accept
precedent: IsAuthenticated (the WC identity is proven by an existing session) + a
single-use token. No chat-platform code exists yet (Slice 2).
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from chat.serializers import ConfirmChatLinkSerializer
from chat.services.linking import (
    LinkTokenExpired,
    LinkTokenInvalid,
    LinkTokenUsed,
    confirm_link,
    revoke_own_links,
)


class ConfirmChatLinkView(APIView):
    """Bind the authenticated user to the chat identity that generated the code."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = ConfirmChatLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            link = confirm_link(
                token=serializer.validated_data["token"], user=request.user
            )
        except LinkTokenExpired:
            return Response(
                {
                    "detail": "This link has expired. Start again from chat.",
                    "code": "expired",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except LinkTokenUsed:
            return Response(
                {"detail": "This link was already used.", "code": "used"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except LinkTokenInvalid:
            return Response(
                {"detail": "This link is not valid.", "code": "invalid"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "status": "linked",
                "platform": link.platform,
                "linked_email": request.user.email,
            }
        )


class RevokeChatLinkView(APIView):
    """Self-service unlink: revoke all of the caller's chat links."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        revoked = revoke_own_links(request.user)
        return Response({"revoked": revoked})
