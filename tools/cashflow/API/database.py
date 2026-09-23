import os
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

DATABASE_SESSION_POOLER = os.environ.get('DATABASE_SESSION_POOLER')

if not DATABASE_SESSION_POOLER:
    raise RuntimeError(
        'DATABASE_SESSION_POOLER environment variable not set - add the Supabase '
        'session pooler connection string to your .env file'
    )

# A small pool rather than one connection per request. Supabase's
# session pooler already pools underneath this, but keeping a pool on
# our side too avoids opening/closing a fresh connection on every
# single request, which adds latency and isn't necessary here.
connection_pool = pool.SimpleConnectionPool(
    minconn=1,
    maxconn=10,
    dsn=DATABASE_SESSION_POOLER,
    sslmode='require',
)


def get_connection():
    """Borrow a connection from the pool. Must be paired with
    release_connection() in a finally block, or the pool will run dry."""
    return connection_pool.getconn()


def release_connection(conn):
    """Return a connection to the pool for reuse."""
    connection_pool.putconn(conn)