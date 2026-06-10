from django.urls import path

from .views import (
    CreateOrganizationView,
    InvitationAcceptView,
    InvitationCancelView,
    InvitationDetailView,
    InvitationListCreateView,
    InvitationResendView,
    MemberListView,
    MyPendingInvitationsView,
)

urlpatterns = [
    path(
        "organizations/",
        CreateOrganizationView.as_view(),
        name="organization-create",
    ),
    path(
        "organizations/<int:org_id>/members/",
        MemberListView.as_view(),
        name="member-list",
    ),
    path(
        "organizations/<int:org_id>/invitations/",
        InvitationListCreateView.as_view(),
        name="invitation-list-create",
    ),
    path(
        "organizations/<int:org_id>/invitations/<int:inv_id>/cancel/",
        InvitationCancelView.as_view(),
        name="invitation-cancel",
    ),
    path(
        "organizations/<int:org_id>/invitations/<int:inv_id>/resend/",
        InvitationResendView.as_view(),
        name="invitation-resend",
    ),
    path(
        "invitations/pending/",
        MyPendingInvitationsView.as_view(),
        name="invitation-pending",
    ),
    path(
        "invitations/<uuid:token>/",
        InvitationDetailView.as_view(),
        name="invitation-detail",
    ),
    path(
        "invitations/<uuid:token>/accept/",
        InvitationAcceptView.as_view(),
        name="invitation-accept",
    ),
]
