from django.urls import path

from chat.adapters.teams.views import TeamsMessagesView
from chat.views import ConfirmChatLinkView, RevokeChatLinkView

urlpatterns = [
    path("links/confirm/", ConfirmChatLinkView.as_view(), name="chat-link-confirm"),
    path("links/revoke/", RevokeChatLinkView.as_view(), name="chat-link-revoke"),
    path("teams/messages/", TeamsMessagesView.as_view(), name="teams-messages"),
]
