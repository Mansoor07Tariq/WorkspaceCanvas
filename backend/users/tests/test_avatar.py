import io

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

User = get_user_model()

ME_URL = "/api/auth/me/"


def _make_image_bytes(fmt: str = "JPEG", size: tuple = (100, 100)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=(255, 0, 0))
    img.save(buf, format=fmt)
    return buf.getvalue()


def _upload_file(
    fmt: str = "JPEG", size_bytes: bytes | None = None
) -> SimpleUploadedFile:
    content_type_map = {
        "JPEG": "image/jpeg",
        "PNG": "image/png",
        "WEBP": "image/webp",
    }
    ext_map = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
    data = size_bytes if size_bytes is not None else _make_image_bytes(fmt)
    return SimpleUploadedFile(
        f"avatar.{ext_map.get(fmt, 'jpg')}",
        data,
        content_type=content_type_map.get(fmt, "image/jpeg"),
    )


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="avatar@example.com",
        email="avatar@example.com",
        password="Testpass1!",
        full_name="Jane Smith",
        is_profile_completed=True,
    )


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# Successful avatar upload
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_upload_jpeg_avatar(auth_client, user):
    resp = auth_client.patch(
        ME_URL, {"avatar": _upload_file("JPEG")}, format="multipart"
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.avatar


@pytest.mark.django_db
def test_upload_png_avatar(auth_client, user):
    resp = auth_client.patch(
        ME_URL, {"avatar": _upload_file("PNG")}, format="multipart"
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.avatar


@pytest.mark.django_db
def test_upload_webp_avatar(auth_client, user):
    resp = auth_client.patch(
        ME_URL, {"avatar": _upload_file("WEBP")}, format="multipart"
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.avatar


@pytest.mark.django_db
def test_avatar_url_present_in_response(auth_client):
    resp = auth_client.patch(
        ME_URL, {"avatar": _upload_file("JPEG")}, format="multipart"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["avatar"] is not None
    assert "users/avatars/" in data["avatar"]


# ---------------------------------------------------------------------------
# Avatar size rejection
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_upload_avatar_too_large_rejected(auth_client):
    oversized = b"x" * (2 * 1024 * 1024 + 1)
    resp = auth_client.patch(
        ME_URL,
        {"avatar": SimpleUploadedFile("big.jpg", oversized, content_type="image/jpeg")},
        format="multipart",
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Invalid image content
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_upload_non_image_bytes_rejected(auth_client):
    fake = SimpleUploadedFile(
        "not_image.jpg", b"not an image at all", content_type="image/jpeg"
    )
    resp = auth_client.patch(ME_URL, {"avatar": fake}, format="multipart")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_upload_svg_rejected(auth_client):
    svg_bytes = (
        b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    )
    svg_file = SimpleUploadedFile("icon.svg", svg_bytes, content_type="image/svg+xml")
    resp = auth_client.patch(ME_URL, {"avatar": svg_file}, format="multipart")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_upload_gif_rejected(auth_client):
    gif_bytes = _make_image_bytes("GIF")
    gif_file = SimpleUploadedFile("anim.gif", gif_bytes, content_type="image/gif")
    resp = auth_client.patch(ME_URL, {"avatar": gif_file}, format="multipart")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# remove_avatar
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_remove_avatar_clears_field(auth_client, user):
    # First upload
    auth_client.patch(ME_URL, {"avatar": _upload_file("JPEG")}, format="multipart")
    user.refresh_from_db()
    assert user.avatar

    # Then remove
    resp = auth_client.patch(ME_URL, {"remove_avatar": "true"}, format="multipart")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert not user.avatar


@pytest.mark.django_db
def test_remove_avatar_returns_null_in_response(auth_client, user):
    auth_client.patch(ME_URL, {"avatar": _upload_file("JPEG")}, format="multipart")
    resp = auth_client.patch(ME_URL, {"remove_avatar": "true"}, format="multipart")
    assert resp.status_code == 200
    assert resp.json()["avatar"] is None


@pytest.mark.django_db
def test_remove_avatar_on_user_with_no_avatar_is_noop(auth_client, user):
    assert not user.avatar
    resp = auth_client.patch(ME_URL, {"remove_avatar": "true"}, format="multipart")
    assert resp.status_code == 200
