"""Flask REST API for Grand Cool service enquiries."""

from __future__ import annotations

import os
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import click
import psycopg
from flask import Flask, current_app, jsonify, request

INDIA_TZ = timezone(timedelta(hours=5, minutes=30))
SERVICE_TYPES = {
    "AC Repair & Servicing",
    "Installation",
    "AMC",
    "AC Sales Enquiry",
}
AC_TYPES = {
    "Split AC",
    "Window AC",
    "Cassette AC",
    "Ductable AC",
    "Commercial system",
    "Not sure yet",
}
FIELD_LIMITS = {
    "name": 120,
    "phone": 32,
    "service": 40,
    "ac_type": 60,
    "area": 160,
    "description": 3000,
}
EXPECTED_FIELDS = set(FIELD_LIMITS) | {"preferred_date"}


def get_db_connection() -> psycopg.Connection:
    """Open a PostgreSQL connection from environment-backed app config."""
    database_url = current_app.config.get("DATABASE_URL")
    if database_url:
        return psycopg.connect(database_url, connect_timeout=4)

    settings = {
        "host": current_app.config.get("PGHOST"),
        "port": current_app.config.get("PGPORT"),
        "dbname": current_app.config.get("PGDATABASE"),
        "user": current_app.config.get("PGUSER"),
        "password": current_app.config.get("PGPASSWORD"),
    }
    missing = [key for key, value in settings.items() if not value]
    if missing:
        raise RuntimeError("PostgreSQL environment settings are incomplete.")
    return psycopg.connect(**settings, connect_timeout=4)


def normalize_phone(value: str) -> str | None:
    compact = re.sub(r"[\s()\-]", "", value)
    match = re.fullmatch(r"(?:\+91|91|0)?([6-9]\d{9})", compact)
    return f"+91{match.group(1)}" if match else None


def validate_enquiry(payload: object) -> tuple[dict[str, object] | None, dict[str, str]]:
    if not isinstance(payload, dict):
        return None, {"request": "Send the enquiry as a JSON object."}

    errors: dict[str, str] = {}
    extras = set(payload) - EXPECTED_FIELDS
    if extras:
        errors["request"] = "The request contains unsupported fields."

    cleaned: dict[str, object] = {}
    for field, limit in FIELD_LIMITS.items():
        value = payload.get(field)
        if not isinstance(value, str):
            errors[field] = "This field is required and must be text."
            continue
        value = value.strip()
        if not value:
            errors[field] = "This field is required."
        elif len(value) > limit:
            errors[field] = f"This field must be {limit} characters or fewer."
        else:
            cleaned[field] = value

    phone = cleaned.get("phone")
    if isinstance(phone, str):
        normalized = normalize_phone(phone)
        if not normalized:
            errors["phone"] = "Enter a valid 10-digit Indian mobile number."
        else:
            cleaned["phone"] = normalized

    service = cleaned.get("service")
    if isinstance(service, str) and service not in SERVICE_TYPES:
        errors["service"] = "Choose a supported service type."

    ac_type = cleaned.get("ac_type")
    if isinstance(ac_type, str) and ac_type not in AC_TYPES:
        errors["ac_type"] = "Choose a supported AC type."

    raw_date = payload.get("preferred_date")
    if not isinstance(raw_date, str) or not raw_date.strip():
        errors["preferred_date"] = "Choose a preferred date."
    else:
        try:
            preferred_date = date.fromisoformat(raw_date.strip())
            if preferred_date.isoformat() != raw_date.strip():
                raise ValueError
            if preferred_date < datetime.now(INDIA_TZ).date():
                errors["preferred_date"] = "Choose today or a future date."
            else:
                cleaned["preferred_date"] = preferred_date
        except ValueError:
            errors["preferred_date"] = "Enter a valid date in YYYY-MM-DD format."

    if not errors:
        return cleaned, {}
    return None, errors


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("FLASK_SECRET_KEY"),
        DATABASE_URL=os.environ.get("DATABASE_URL"),
        PGHOST=os.environ.get("PGHOST"),
        PGPORT=os.environ.get("PGPORT", "5432"),
        PGDATABASE=os.environ.get("PGDATABASE"),
        PGUSER=os.environ.get("PGUSER"),
        PGPASSWORD=os.environ.get("PGPASSWORD"),
        CORS_ALLOWED_ORIGINS=os.environ.get(
            "CORS_ALLOWED_ORIGINS",
            "http://127.0.0.1:5500,http://localhost:5500",
        ),
        MAX_CONTENT_LENGTH=32 * 1024,
    )
    if test_config:
        app.config.update(test_config)
    secret_key = app.config.get("SECRET_KEY")
    if not app.testing and (
        not isinstance(secret_key, str)
        or len(secret_key) < 32
        or secret_key.startswith("replace-")
    ):
        raise RuntimeError(
            "Set FLASK_SECRET_KEY to a generated value of at least 32 characters before starting Flask."
        )

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        allowed = app.config.get("CORS_ALLOWED_ORIGINS", "")
        if isinstance(allowed, str):
            allowed_origins = {item.strip() for item in allowed.split(",") if item.strip()}
        else:
            allowed_origins = set(allowed)
        if origin and origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            response.headers.add("Vary", "Origin")
        return response

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify(error="The enquiry is too large. Shorten the description and try again."), 413

    @app.get("/api/health")
    def health_check():
        try:
            with get_db_connection() as connection:
                connection.execute("SELECT 1")
            return jsonify(status="ok", database="available"), 200
        except (psycopg.Error, RuntimeError):
            current_app.logger.warning("Health check could not reach PostgreSQL.")
            return jsonify(status="unavailable", database="unavailable"), 503

    @app.post("/api/service-enquiries")
    def create_service_enquiry():
        if not request.is_json:
            return jsonify(error="Content-Type must be application/json."), 415

        payload = request.get_json(silent=True)
        cleaned, errors = validate_enquiry(payload)
        if errors:
            return jsonify(error="Please correct the enquiry fields.", fields=errors), 400

        reference_number = (
            f"GC-{datetime.now(INDIA_TZ):%Y%m%d}-{uuid.uuid4().hex[:12].upper()}"
        )
        sql = """
            INSERT INTO service_enquiries (
                reference_number, customer_name, phone, service_type, ac_type,
                location, preferred_date, issue_description
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            reference_number,
            cleaned["name"],
            cleaned["phone"],
            cleaned["service"],
            cleaned["ac_type"],
            cleaned["area"],
            cleaned["preferred_date"],
            cleaned["description"],
        )

        try:
            # psycopg commits on a clean context exit; only return the reference
            # after the insert transaction has completed successfully.
            with get_db_connection() as connection:
                connection.execute(sql, values)
        except (psycopg.Error, RuntimeError):
            current_app.logger.exception("PostgreSQL could not save a service enquiry.")
            return jsonify(error="The enquiry could not be saved because the database is unavailable."), 503

        return jsonify(reference_number=reference_number, status="saved"), 201

    @app.cli.command("init-db")
    def init_db_command():
        """Create the service enquiry table if it does not exist."""
        schema_path = Path(__file__).with_name("schema.sql")
        schema = schema_path.read_text(encoding="utf-8")
        try:
            with get_db_connection() as connection:
                connection.execute(schema)
        except (psycopg.Error, RuntimeError):
            raise click.ClickException(
                "Database setup failed. Check PostgreSQL is running and the environment settings are correct."
            ) from None
        click.echo("Database schema is ready.")

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=5000)
