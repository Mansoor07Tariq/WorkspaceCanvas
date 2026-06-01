from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle
from rest_framework.views import APIView

from .models import Invitation, MemberRole, Membership, Organization
from .serializers import (
    CreateInvitationSerializer,
    CreateOrganizationSerializer,
    InvitationPublicSerializer,
    InvitationSerializer,
    MembershipSerializer,
    OrganizationResponseSerializer,
)


def _invite_throttle_cache_key(throttle: SimpleRateThrottle, request: Request) -> str:
    """Cache key builder for invitation throttles.

    Authenticated callers are keyed by user pk; anonymous callers (the public
    invitation-detail lookup) fall back to the request IP via get_ident.
    """
    if request.user.is_authenticated:
        ident = request.user.pk
    else:
        ident = throttle.get_ident(request)
    return throttle.cache_format % {"scope": throttle.scope, "ident": ident}


class _InviteWriteThrottle(SimpleRateThrottle):
    """Applies the invite_write scope only on POST (create/cancel/accept)."""

    scope = "invite_write"

    def get_cache_key(self, request: Request, view) -> str | None:  # type: ignore[override]
        return _invite_throttle_cache_key(self, request)

    def allow_request(self, request: Request, view) -> bool:  # type: ignore[override]
        if request.method != "POST":
            return True
        return super().allow_request(request, view)


class _InvitePublicReadThrottle(SimpleRateThrottle):
    """Throttles the public (unauthenticated) invitation-detail lookup by IP.

    Tokens are UUIDv4 and unguessable, but this caps token-scanning attempts
    against the AllowAny detail endpoint.
    """

    scope = "invite_read"

    def get_cache_key(self, request: Request, view) -> str | None:  # type: ignore[override]
        return _invite_throttle_cache_key(self, request)


def _get_active_org_or_404(organization_id: int) -> Organization:
    try:
        return Organization.objects.get(
            id=organization_id, status=Organization.Status.ACTIVE
        )
    except Organization.DoesNotExist:
        raise NotFound("Organization not found.")


def _require_manager(user, org: Organization) -> Membership:
    """Require ACTIVE owner/admin membership; raise 403 otherwise."""
    try:
        membership = Membership.objects.select_related("organization").get(
            user=user, organization=org
        )
    except Membership.DoesNotExist:
        raise PermissionDenied("You do not have access to this organization.")
    if not membership.has_active_access:
        raise PermissionDenied("Your membership is not active.")
    if membership.role not in [MemberRole.OWNER, MemberRole.ADMIN]:
        raise PermissionDenied("Only owners and admins can perform this action.")
    return membership


def _require_member(user, org: Organization) -> Membership:
    """Require any ACTIVE membership; raise 403 otherwise."""
    try:
        membership = Membership.objects.select_related("organization").get(
            user=user, organization=org
        )
    except Membership.DoesNotExist:
        raise PermissionDenied("You do not have access to this organization.")
    if not membership.has_active_access:
        raise PermissionDenied("Your membership is not active.")
    return membership


class CreateOrganizationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "org_create"

    @extend_schema(
        request=CreateOrganizationSerializer,
        responses={201: OrganizationResponseSerializer},
        summary=("Create a new organization and enroll the requesting user as owner"),
    )
    def post(self, request: Request) -> Response:
        if not request.user.is_profile_completed:
            return Response(
                {"detail": "Complete your profile before creating an organization."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CreateOrganizationSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        org = serializer.save()
        return Response(
            OrganizationResponseSerializer(org).data,
            status=status.HTTP_201_CREATED,
        )


class MemberListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: MembershipSerializer(many=True)},
        summary="List members of an organization",
    )
    def get(self, request: Request, org_id: int) -> Response:
        org = _get_active_org_or_404(org_id)
        _require_member(request.user, org)
        memberships = (
            Membership.objects.filter(
                organization=org,
                status=Membership.Status.ACTIVE,
            )
            .select_related("user")
            .order_by("user__email")
        )
        serializer = MembershipSerializer(
            memberships, many=True, context={"request": request}
        )
        return Response(serializer.data)


class InvitationListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_InviteWriteThrottle]

    @extend_schema(
        responses={200: InvitationSerializer(many=True)},
        summary="List pending invitations for an organization",
    )
    def get(self, request: Request, org_id: int) -> Response:
        org = _get_active_org_or_404(org_id)
        _require_manager(request.user, org)
        invitations = (
            Invitation.objects.filter(
                organization=org,
                status=Invitation.Status.PENDING,
            )
            .select_related("invited_by", "accepted_by")
            .order_by("-created_at")
        )
        serializer = InvitationSerializer(invitations, many=True)
        return Response(serializer.data)

    @extend_schema(
        request=CreateInvitationSerializer,
        responses={201: InvitationSerializer},
        summary="Create an invitation for a new member",
    )
    def post(self, request: Request, org_id: int) -> Response:
        org = _get_active_org_or_404(org_id)
        _require_manager(request.user, org)
        serializer = CreateInvitationSerializer(
            data=request.data,
            context={"request": request, "organization": org},
        )
        serializer.is_valid(raise_exception=True)
        invitation = serializer.save()
        return Response(
            InvitationSerializer(invitation).data,
            status=status.HTTP_201_CREATED,
        )


class InvitationCancelView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_InviteWriteThrottle]

    @extend_schema(
        responses={200: InvitationSerializer},
        summary="Cancel a pending invitation",
    )
    def post(self, request: Request, org_id: int, inv_id: int) -> Response:
        org = _get_active_org_or_404(org_id)
        _require_manager(request.user, org)
        try:
            invitation = Invitation.objects.get(id=inv_id, organization=org)
        except Invitation.DoesNotExist:
            raise NotFound("Invitation not found.")
        if invitation.status != Invitation.Status.PENDING:
            raise ValidationError(
                {"detail": "Only pending invitations can be cancelled."}
            )
        invitation.status = Invitation.Status.CANCELLED
        invitation.save(update_fields=["status", "updated_at"])
        return Response(InvitationSerializer(invitation).data)


class InvitationDetailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [_InvitePublicReadThrottle]

    @extend_schema(
        responses={200: InvitationPublicSerializer},
        summary="Get public invitation details by token",
    )
    def get(self, request: Request, token: str) -> Response:
        try:
            invitation = Invitation.objects.select_related("organization").get(
                token=token
            )
        except Invitation.DoesNotExist:
            raise NotFound("Invitation not found.")
        serializer = InvitationPublicSerializer(invitation)
        return Response(serializer.data)


class InvitationAcceptView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [_InviteWriteThrottle]

    @extend_schema(
        responses={200: MembershipSerializer},
        summary="Accept an invitation (authenticated user only)",
    )
    def post(self, request: Request, token: str) -> Response:
        try:
            invitation = Invitation.objects.select_related("organization").get(
                token=token
            )
        except Invitation.DoesNotExist:
            raise NotFound("Invitation not found.")

        if invitation.status == Invitation.Status.CANCELLED:
            raise ValidationError({"detail": "This invitation has been cancelled."})
        if invitation.status == Invitation.Status.ACCEPTED:
            raise ValidationError(
                {"detail": "This invitation has already been accepted."}
            )
        if invitation.status != Invitation.Status.PENDING:
            raise ValidationError({"detail": "This invitation is no longer valid."})
        if invitation.is_expired:
            raise ValidationError({"detail": "This invitation has expired."})

        if request.user.email.lower() != invitation.email.lower():
            raise PermissionDenied(
                "This invitation was sent to a different email address."
            )

        org = invitation.organization
        if org.status != Organization.Status.ACTIVE:
            raise ValidationError({"detail": "This organization is no longer active."})

        with transaction.atomic():
            membership, created = Membership.objects.get_or_create(
                user=request.user,
                organization=org,
                defaults={
                    "role": invitation.role,
                    "status": Membership.Status.ACTIVE,
                },
            )
            if not created:
                if membership.status == Membership.Status.ACTIVE:
                    raise ValidationError(
                        {"detail": "You are already a member of this organization."}
                    )
                membership.role = invitation.role
                membership.status = Membership.Status.ACTIVE
                membership.save(update_fields=["role", "status", "updated_at"])

            invitation.status = Invitation.Status.ACCEPTED
            invitation.accepted_by = request.user
            invitation.accepted_at = timezone.now()
            invitation.save(
                update_fields=["status", "accepted_by", "accepted_at", "updated_at"]
            )

        membership.refresh_from_db()
        return Response(
            MembershipSerializer(membership, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )
