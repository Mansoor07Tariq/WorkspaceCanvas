"""Microsoft Teams messaging endpoint (PR 078, review/26).

Order is the security contract (review/26 §1 + reviewer's config guard):
  1. fail closed if the adapter is unconfigured (503) — never validate on empty aud
  2. validate the Bot Framework JWT — reject-before-anything (401, NO dedupe/audit/glue)
  3. dedupe on activity id (redelivery → 200, no re-handle)
  4. normalize → dispatch to the EXISTING router / execute_confirmed (no new intents)
  5. reply via the Connector API (Adaptive Card for CONFIRM; result card replaces a
     handled confirm card)
"""

from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from chat.adapters.teams.activity import strip_bot_mention, submit_value, teams_identity
from chat.adapters.teams.auth import (
    TeamsAuthError,
    TeamsConfigError,
    require_teams_config,
    validate_activity_jwt,
)
from chat.adapters.teams.cards import (
    confirm_card_activity,
    result_card_activity,
    text_activity,
)
from chat.adapters.teams.connector import ConnectorClient
from chat.commands import CommandRouter, Reply, ReplyKind
from chat.services.glue import ServiceGlue, record_event

logger = logging.getLogger(__name__)
PLATFORM = "teams"


class TeamsMessagesView(APIView):
    # Authenticated by the Bot Framework JWT, which we validate ourselves — DRF auth
    # must not run (it would reject the BF token as a bad WC JWT).
    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        # 1. Fail closed when unconfigured (never validate against an empty audience,
        #    and never accept an activity we couldn't reply to — outbound needs tenant).
        try:
            app_id, app_password, tenant_id = require_teams_config()
        except TeamsConfigError:
            return Response(
                {"detail": "Teams integration is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        activity = request.data if isinstance(request.data, dict) else {}
        service_url = activity.get("serviceUrl")

        # 2. Reject-before-anything: validate the inbound JWT FIRST.
        try:
            validate_activity_jwt(
                request.META.get("HTTP_AUTHORIZATION"),
                app_id=app_id,
                service_url=service_url,
            )
        except TeamsAuthError:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        # 3. Dedupe on the activity id (platforms redeliver on timeout).
        event_id = activity.get("id")
        if event_id and not record_event(PLATFORM, str(event_id)):
            return Response(status=status.HTTP_200_OK)  # already processed

        # 4. Normalize identity + dispatch through the EXISTING core.
        external_user_id, external_team_id = teams_identity(activity)
        reply, replace_card_id = self._dispatch(
            activity, external_user_id, external_team_id
        )

        # 5. Reply (best-effort — the command is already handled + audited).
        self._deliver(
            ConnectorClient(
                app_id=app_id, app_password=app_password, tenant_id=tenant_id
            ),
            activity,
            reply,
            replace_card_id,
        )
        return Response(status=status.HTTP_200_OK)

    def _dispatch(self, activity, external_user_id, external_team_id):
        glue = ServiceGlue()
        value = submit_value(activity)
        if value and value.get("action") == "confirm":
            reply = glue.execute_confirmed(
                platform=PLATFORM,
                external_user_id=external_user_id,
                token_str=str(value.get("token", "")),
            )
            return reply, activity.get("replyToId")
        if value and value.get("action") == "cancel":
            return Reply.text_reply("Okay — nothing booked."), activity.get("replyToId")

        text = strip_bot_mention(activity.get("text", ""))
        inbound = CommandRouter.parse_text(
            text,
            platform=PLATFORM,
            external_user_id=external_user_id,
            external_team_id=external_team_id,
        )
        return glue.handle(inbound), None

    def _deliver(self, connector, activity, reply: Reply, replace_card_id):
        service_url = activity.get("serviceUrl", "")
        conversation_id = (activity.get("conversation") or {}).get("id", "")
        if not service_url or not conversation_id:
            return
        try:
            if reply.kind == ReplyKind.CONFIRM and reply.confirm is not None:
                connector.send_activity(
                    service_url=service_url,
                    conversation_id=conversation_id,
                    activity=confirm_card_activity(
                        text=reply.text, token=reply.confirm.token
                    ),
                )
            elif replace_card_id:
                connector.update_activity(
                    service_url=service_url,
                    conversation_id=conversation_id,
                    activity_id=replace_card_id,
                    activity=result_card_activity(reply.text),
                )
            else:
                connector.send_activity(
                    service_url=service_url,
                    conversation_id=conversation_id,
                    activity=text_activity(reply.text),
                )
        except Exception:  # noqa: BLE001 - reply delivery is best-effort; never 500 the webhook
            logger.exception("Teams reply delivery failed")
