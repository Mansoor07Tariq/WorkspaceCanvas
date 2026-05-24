from django.conf import settings
from rest_framework import serializers

from .models import MFALoginChallenge, RecoveryCode, User, UserMFADevice
from .reauth import verify_reauth_for_user
from .serializers import build_jwt_response_for_user

_IDENTITY_FAILED = {
    "detail": "Identity verification failed.",
    "code": "identity_verification_failed",
}
_MFA_PROOF_FAILED = {
    "detail": "Invalid MFA proof.",
    "code": "invalid_mfa_proof",
}


class MFAStatusSerializer(serializers.Serializer):
    mfa_enabled = serializers.BooleanField(read_only=True)
    has_confirmed_device = serializers.BooleanField(read_only=True)
    recovery_codes_remaining = serializers.IntegerField(read_only=True)


class MFASetupSerializer(serializers.Serializer):
    provisioning_uri = serializers.CharField(read_only=True)
    qr_code_base64 = serializers.CharField(read_only=True)


class MFAConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(min_length=6, max_length=6)

    def validate_token(self, value: str) -> str:
        if not value.isdigit():
            raise serializers.ValidationError("Token must be a 6-digit number.")
        return value

    def validate(self, data):
        user: User = self.context["request"].user
        try:
            device = UserMFADevice.objects.get(user=user)
        except UserMFADevice.DoesNotExist:
            raise serializers.ValidationError(
                {"detail": "No MFA device found. Run setup first."}
            )
        if device.is_confirmed:
            raise serializers.ValidationError(
                {"detail": "MFA is already confirmed and enabled."}
            )
        if not device.verify_token(data["token"]):
            raise serializers.ValidationError({"token": "Invalid TOTP token."})
        data["device"] = device
        return data

    def save(self) -> list[str]:
        device: UserMFADevice = self.validated_data["device"]
        device.confirm()
        return RecoveryCode.generate_codes_for_user(
            device.user, settings.MFA_RECOVERY_CODE_COUNT
        )


class MFADisableSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=False)
    provider = serializers.ChoiceField(choices=["google", "microsoft"], required=False)
    access_token = serializers.CharField(required=False, allow_blank=True)
    id_token = serializers.CharField(required=False, allow_blank=True)
    token = serializers.CharField(min_length=6, max_length=6, required=False)
    recovery_code = serializers.CharField(required=False)

    def validate(self, data):
        user: User = self.context["request"].user

        if not verify_reauth_for_user(
            user,
            request=self.context.get("request"),
            password=data.get("password"),
            provider=data.get("provider"),
            access_token=data.get("access_token"),
            id_token=data.get("id_token"),
        ):
            raise serializers.ValidationError(_IDENTITY_FAILED)

        token = data.get("token") or ""
        recovery_code = data.get("recovery_code") or ""

        if not token and not recovery_code:
            raise serializers.ValidationError(
                {"detail": "Provide either a TOTP token or a recovery code."}
            )

        if not _verify_mfa_proof(user, token=token, recovery_code=recovery_code):
            raise serializers.ValidationError(_MFA_PROOF_FAILED)

        return data

    def save(self) -> None:
        user: User = self.context["request"].user
        UserMFADevice.objects.filter(user=user).delete()
        RecoveryCode.objects.filter(user=user).delete()
        user.mfa_enabled = False
        user.mfa_verified_at = None
        user.save(update_fields=["mfa_enabled", "mfa_verified_at"])


class RecoveryCodeRegenerateSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=False)
    provider = serializers.ChoiceField(choices=["google", "microsoft"], required=False)
    access_token = serializers.CharField(required=False, allow_blank=True)
    id_token = serializers.CharField(required=False, allow_blank=True)
    token = serializers.CharField(min_length=6, max_length=6, required=False)
    recovery_code = serializers.CharField(required=False)

    def validate(self, data):
        user: User = self.context["request"].user

        if not user.mfa_enabled:
            raise serializers.ValidationError({"detail": "MFA is not enabled."})

        if not verify_reauth_for_user(
            user,
            request=self.context.get("request"),
            password=data.get("password"),
            provider=data.get("provider"),
            access_token=data.get("access_token"),
            id_token=data.get("id_token"),
        ):
            raise serializers.ValidationError(_IDENTITY_FAILED)

        token = data.get("token") or ""
        recovery_code = data.get("recovery_code") or ""

        if not token and not recovery_code:
            raise serializers.ValidationError(
                {"detail": "Provide either a TOTP token or a recovery code."}
            )

        if not _verify_mfa_proof(user, token=token, recovery_code=recovery_code):
            raise serializers.ValidationError(_MFA_PROOF_FAILED)

        return data

    def save(self) -> list[str]:
        user: User = self.context["request"].user
        return RecoveryCode.generate_codes_for_user(
            user, settings.MFA_RECOVERY_CODE_COUNT
        )


class MFALoginChallengeVerifySerializer(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    token = serializers.CharField(min_length=6, max_length=6, required=False)
    recovery_code = serializers.CharField(required=False)

    def validate(self, data):
        try:
            challenge = MFALoginChallenge.objects.select_related("user").get(
                challenge_id=data["challenge_id"]
            )
        except MFALoginChallenge.DoesNotExist:
            raise serializers.ValidationError(
                {"detail": "Invalid MFA challenge.", "code": "invalid_mfa_challenge"}
            )

        if challenge.is_used:
            raise serializers.ValidationError(
                {
                    "detail": "MFA challenge has already been used.",
                    "code": "used_mfa_challenge",
                }
            )

        if challenge.is_expired:
            raise serializers.ValidationError(
                {
                    "detail": "MFA challenge has expired.",
                    "code": "expired_mfa_challenge",
                }
            )

        token = data.get("token") or ""
        recovery_code = data.get("recovery_code") or ""

        if not token and not recovery_code:
            raise serializers.ValidationError(
                {
                    "detail": "MFA token or recovery code is required.",
                    "code": "missing_mfa_proof",
                }
            )

        if not _verify_mfa_proof(
            challenge.user, token=token, recovery_code=recovery_code
        ):
            raise serializers.ValidationError(
                {"detail": "Invalid MFA proof.", "code": "invalid_mfa_proof"}
            )

        data["challenge"] = challenge
        return data

    def save(self) -> dict:
        challenge: MFALoginChallenge = self.validated_data["challenge"]
        challenge.mark_used()
        return build_jwt_response_for_user(challenge.user)


def _verify_mfa_proof(user: User, *, token: str, recovery_code: str) -> bool:
    if token:
        try:
            device = UserMFADevice.objects.get(user=user, confirmed_at__isnull=False)
            return device.verify_token(token)
        except UserMFADevice.DoesNotExist:
            return False

    if recovery_code:
        for code in RecoveryCode.objects.filter(user=user, used_at__isnull=True):
            if code.check_code(recovery_code):
                code.mark_used()
                return True
        return False

    return False
