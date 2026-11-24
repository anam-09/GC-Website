"""API tests. Persistence tests use only an explicitly configured test database."""

import os
from datetime import datetime, timedelta, timezone

import psycopg
import pytest

import app as app_module
from app import create_app


def valid_payload() -> dict[str, str]:
    india_timezone = timezone(timedelta(hours=5, minutes=30))
    preferred_date = datetime.now(india_timezone).date() + timedelta(days=2)
    return {
        "name": "Test Customer",
        "phone": "+91 98765 43210",
        "service": "AC Repair & Servicing",
        "ac_type": "Split AC",
        "area": "Pirangut",
        "preferred_date": preferred_date.isoformat(),
        "description": "Automated test enquiry; not a real customer.",
    }


@pytest.fixture
def client():
    application = create_app({
        "TESTING": True,
        "SECRET_KEY": "test-only-key",
        "DATABASE_URL": os.environ.get("TEST_DATABASE_URL"),
        "CORS_ALLOWED_ORIGINS": [],
    })
    return application.test_client()


def test_rejects_missing_and_invalid_fields_without_database(client):
    payload = valid_payload()
    payload["phone"] = "12345"
    payload["service"] = "Unlisted service"
    response = client.post("/api/service-enquiries", json=payload)

    assert response.status_code == 400
    assert "phone" in response.json["fields"]
    assert "service" in response.json["fields"]

    response = client.post("/api/service-enquiries", json={})
    assert response.status_code == 400
    assert "name" in response.json["fields"]


def test_rejects_past_preferred_date(client):
    payload = valid_payload()
    payload["preferred_date"] = "2000-01-01"
    response = client.post("/api/service-enquiries", json=payload)

    assert response.status_code == 400
    assert "preferred_date" in response.json["fields"]


def test_returns_database_unavailable_without_reference(client, monkeypatch):
    def unavailable_connection():
        raise psycopg.OperationalError("test database is unavailable")

    monkeypatch.setattr(app_module, "get_db_connection", unavailable_connection)
    response = client.post("/api/service-enquiries", json=valid_payload())

    assert response.status_code == 503
    assert "reference_number" not in response.json


def test_health_reports_database_unavailable(client, monkeypatch):
    def unavailable_connection():
        raise psycopg.OperationalError("test database is unavailable")

    monkeypatch.setattr(app_module, "get_db_connection", unavailable_connection)
    response = client.get("/api/health")

    assert response.status_code == 503
    assert response.json["status"] == "unavailable"


def test_enquiries_cannot_be_listed_publicly(client):
    response = client.get("/api/service-enquiries")
    assert response.status_code == 405


def test_valid_submission_is_written_to_postgres_and_reference_is_returned():
    test_database_url = os.environ.get("TEST_DATABASE_URL")
    if not test_database_url:
        pytest.skip("Set TEST_DATABASE_URL to run the PostgreSQL persistence test.")

    application = create_app({
        "TESTING": True,
        "SECRET_KEY": "test-only-key",
        "DATABASE_URL": test_database_url,
        "CORS_ALLOWED_ORIGINS": [],
    })
    schema = (app_module.Path(__file__).parents[1] / "schema.sql").read_text(encoding="utf-8")
    with psycopg.connect(test_database_url) as connection:
        connection.execute(schema)

    with application.test_client() as client:
        response = client.post("/api/service-enquiries", json=valid_payload())

    assert response.status_code == 201
    reference = response.json["reference_number"]
    assert response.json["status"] == "saved"
    try:
        with psycopg.connect(test_database_url) as connection:
            row = connection.execute(
                "SELECT customer_name, phone FROM service_enquiries WHERE reference_number = %s",
                (reference,),
            ).fetchone()
            assert row == ("Test Customer", "+919876543210")
            connection.execute(
                "DELETE FROM service_enquiries WHERE reference_number = %s",
                (reference,),
            )
    finally:
        # A test enquiry must not remain in the configured test database.
        with psycopg.connect(test_database_url) as connection:
            connection.execute(
                "DELETE FROM service_enquiries WHERE reference_number = %s",
                (reference,),
            )
