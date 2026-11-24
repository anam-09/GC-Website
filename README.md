# Grand Cool Service Enquiry API

Phase 2 adds a Flask REST API and PostgreSQL persistence for the existing service enquiry form. The frontend and API remain separate; no admin dashboard or public enquiry listing is included.

## Requirements

- Python 3.10 or newer
- PostgreSQL 14 or newer
- The existing website files in this repository

## 1. Create a local PostgreSQL role and database

Connect to PostgreSQL as an administrator and run these statements. Replace the password placeholder locally; do not put a real password in a tracked file.

```sql
CREATE ROLE grandcool_app LOGIN PASSWORD 'choose-a-local-password';
CREATE DATABASE grandcool OWNER grandcool_app;
```

If the role or database already exists, keep using your existing local setup instead of rerunning those statements.

## 2. Install the Python dependencies

From PowerShell at the project root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

`backend/.env.example` lists the environment variable names and safe placeholders. Set the variables in the same PowerShell window used to run Flask. The example file is not loaded automatically.

```powershell
$env:FLASK_SECRET_KEY = (python -c "import secrets; print(secrets.token_hex(32))")
$env:PGHOST = "127.0.0.1"
$env:PGPORT = "5432"
$env:PGDATABASE = "grandcool"
$env:PGUSER = "grandcool_app"
$env:PGPASSWORD = Read-Host "Local PostgreSQL password"
$env:CORS_ALLOWED_ORIGINS = "http://127.0.0.1:5500,http://localhost:5500"
```

Keep the generated secret and database password in environment variables or an approved secret manager. Do not paste real values into `.env.example`, source files, or commits.

## 3. Create the table and run the API

Still in the `backend` directory, with the environment variables set:

```powershell
python -m flask --app app init-db
python -m flask --app app run --host 127.0.0.1 --port 5000
```

The API listens on `http://127.0.0.1:5000`. The website currently points to `http://127.0.0.1:5000/api/service-enquiries` in the `service-api-url` meta tag in `index.html`. Change that URL and `CORS_ALLOWED_ORIGINS` for the eventual deployment origins. Do not use a wildcard CORS origin.

In another terminal, serve the website from the project root (or use VS Code Live Server on port 5500):

```powershell
py -m http.server 5500 --bind 127.0.0.1
```

Open `http://127.0.0.1:5500/` and submit the booking form. The browser sends the enquiry to Flask; the form shows a reference number only after PostgreSQL commits the insert and the API returns it. WhatsApp remains a separate optional contact action.

## API

- `GET /api/health` checks that the API can connect to PostgreSQL. It returns `200` when available and `503` when unavailable.
- `POST /api/service-enquiries` validates and saves a service enquiry. On success it returns HTTP `201` with a unique `reference_number` and `status: "saved"`.

There is no endpoint to list or read customer enquiries. The API validates required fields, supported service and AC types, Indian mobile numbers, field lengths, ISO dates, and rejects dates earlier than the current date in India. Database inserts use parameters and the server returns no reference number before the transaction commits.

## Test the API

Check API and database health:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

Test server-side validation (expected HTTP 400):

```powershell
curl.exe -i -X POST http://127.0.0.1:5000/api/service-enquiries `
  -H "Content-Type: application/json" `
  -d '{"name":"Test","phone":"123"}'
```

Run the automated tests from the `backend` directory:

```powershell
python -m pytest -q
```

Validation, public-listing protection, and database-unavailable behavior run without a database. The persistence test is skipped unless `TEST_DATABASE_URL` points to a dedicated test database with permission to create the application table. Do not point it at production. Set that variable only in the test terminal, then run pytest; the persistence test creates the table if needed, writes a clearly labeled test enquiry, verifies it, and deletes that row afterward.

## Data handling notes

Enquiries contain personal contact details. Keep database access restricted, use HTTPS in deployment, protect backups, and set a retention policy before production use. Do not expose PostgreSQL directly to browsers or add a public endpoint for customer records.
