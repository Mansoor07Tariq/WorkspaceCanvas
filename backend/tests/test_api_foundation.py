import pytest


@pytest.fixture
def api_client(client, settings):
    settings.ALLOWED_HOSTS = ["testserver"]
    return client


def test_health_returns_200(api_client):
    response = api_client.get("/api/health/")
    assert response.status_code == 200


def test_health_response_body(api_client):
    response = api_client.get("/api/health/")
    data = response.json()
    assert data["status"] == "ok"
    assert "message" in data


def test_schema_returns_200(api_client):
    response = api_client.get("/api/schema/")
    assert response.status_code == 200


def test_docs_returns_200(api_client):
    response = api_client.get("/api/docs/")
    assert response.status_code == 200
