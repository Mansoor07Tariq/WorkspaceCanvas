from django.urls import path

from chat.views import ConfirmChatLinkView, RevokeChatLinkView

urlpatterns = [
    path("links/confirm/", ConfirmChatLinkView.as_view(), name="chat-link-confirm"),
    path("links/revoke/", RevokeChatLinkView.as_view(), name="chat-link-revoke"),
]
