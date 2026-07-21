"""
extensions.py

The single place `app`, `jwt`, and `limiter` get created. Every route
module (routes/*.py) imports these three from here rather than each
creating its own - Flask/JWT/the rate limiter only make sense as ONE
shared instance the whole process registers routes against, not one
per file.

This is also why route modules use `@app.route(...)` directly (the
same shared Flask app object) rather than Blueprint objects - simpler,
and every route keeps its exact existing path/behavior with nothing to
re-wire (no url_prefix, no blueprint registration step to get subtly
wrong). backend.py is what actually imports every routes/*.py module
(causing their @app.route(...) decorators to run and register against
this same `app`), then re-exports `app` for gunicorn.
"""
import os
from datetime import timedelta

from flask import Flask
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from flask_cors import CORS

from database import get_connection, release_connection

load_dotenv()

app = Flask(__name__)

CORS(
    app,
    supports_credentials=True,
    origins=["http://localhost:5173"],  # swap for real web dev/prod origin(s) as you go
)

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')

# Replaces the old JWT_ACCESS_TOKEN_EXPIRES = False (tokens that never
# expired at all, no matter which of login/signup/impersonate issued
# them - see handoff5.txt for why that was a real problem, not a
# theoretical one). Access tokens are now short-lived; refresh tokens
# (created via create_refresh_token(), used by /auth/refresh) are the
# longer-lived thing that lets the app/CLI silently obtain a new access
# token without asking for a password again, right up until the
# refresh token itself expires or is revoked.
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

app.config['JWT_TOKEN_LOCATION'] = ['headers', 'cookies']  # both, so RN keeps working unchanged
app.config['JWT_COOKIE_SECURE'] = True
app.config['JWT_COOKIE_SAMESITE'] = 'None'  # adjust once you know your web/API domain layout
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_ACCESS_COOKIE_NAME'] = 'access_token_cookie'
app.config['JWT_REFRESH_COOKIE_NAME'] = 'refresh_token_cookie'
# Deliberately much shorter than a normal access token, and passed
# explicitly as expires_delta on the ONE call site that uses it
# (admin_impersonate_user, in routes/admin.py) rather than being a
# global default - an impersonation session is a bounded admin task,
# not something that should be able to linger for a full day like an
# ordinary login.
IMPERSONATION_TOKEN_EXPIRES = timedelta(minutes=15)

jwt = JWTManager(app)


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    """Runs automatically on EVERY @jwt_required()-protected request,
    right after signature verification succeeds - this is what makes
    revocation (POST /auth/logout, POST /admin/tokens/revoke) actually
    mean something, as opposed to inserting rows into a table nothing
    ever reads. A signature-valid-but-revoked token is rejected here
    with the same effect as an expired one."""
    jti = jwt_payload["jti"]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM revoked_tokens WHERE jti = %s", (jti,))
            return cur.fetchone() is not None
    finally:
        release_connection(conn)


limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["20 per day", "50 per hour"],
    storage_uri="memory://",
)


