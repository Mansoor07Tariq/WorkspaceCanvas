from rest_framework import serializers


class ConfirmChatLinkSerializer(serializers.Serializer):
    """The web confirm step: the user submits the link code shown in their chat DM."""

    token = serializers.CharField(max_length=64)
