import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class StrongPasswordValidator:
    """
    Requires at least one uppercase letter, one digit, and one special character.
    Works alongside Django's MinimumLengthValidator in AUTH_PASSWORD_VALIDATORS.
    """

    def validate(self, password, user=None):
        errors = []
        if not re.search(r"[A-Z]", password):
            errors.append(
                ValidationError(
                    _("Password must contain at least one uppercase letter."),
                    code="password_no_upper",
                )
            )
        if not re.search(r"[0-9]", password):
            errors.append(
                ValidationError(
                    _("Password must contain at least one number."),
                    code="password_no_number",
                )
            )
        if not re.search(r"[^A-Za-z0-9]", password):
            errors.append(
                ValidationError(
                    _("Password must contain at least one special character."),
                    code="password_no_special",
                )
            )
        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            "Your password must contain at least one uppercase letter, "
            "one number, and one special character."
        )
