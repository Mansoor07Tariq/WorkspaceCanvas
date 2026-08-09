from django.contrib import admin

from chat.models import (
    BotActionAudit,
    ChatConfirmToken,
    ChatLink,
    ProcessedChatEvent,
)


@admin.register(ChatLink)
class ChatLinkAdmin(admin.ModelAdmin):
    list_display = ["platform", "external_user_id", "user", "status", "linked_at"]
    list_filter = ["platform", "status"]
    search_fields = ["external_user_id", "user__email"]
    readonly_fields = ["token", "created_at", "updated_at", "used_at", "linked_at"]


@admin.register(BotActionAudit)
class BotActionAuditAdmin(admin.ModelAdmin):
    list_display = [
        "created_at",
        "platform",
        "external_user_id",
        "user",
        "command",
        "result",
    ]
    list_filter = ["platform", "result", "command"]
    search_fields = ["external_user_id", "user__email", "command"]
    readonly_fields = [f.name for f in BotActionAudit._meta.fields]


@admin.register(ChatConfirmToken)
class ChatConfirmTokenAdmin(admin.ModelAdmin):
    list_display = ["token", "user", "action", "used_at", "expires_at", "created_at"]
    list_filter = ["action"]
    readonly_fields = [f.name for f in ChatConfirmToken._meta.fields]


@admin.register(ProcessedChatEvent)
class ProcessedChatEventAdmin(admin.ModelAdmin):
    list_display = ["platform", "event_id", "created_at"]
    list_filter = ["platform"]
