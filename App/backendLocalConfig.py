import os
from dotenv import load_dotenv

# App/.env is one level up from THIS file's own location (App/API/) -
# App/API is Render's "Root Directory" for cwd purposes, but the repo
# is still fully checked out, so App/.env genuinely exists on disk and
# is reachable via the file's own real path, regardless of cwd.
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

LOCAL_DEV = os.environ.get('VITE_LOCAL_DEV', 'false').lower() == 'true'
CORS_ORIGINS = ["http://192.168.0.15:5173"] if LOCAL_DEV else ["https://ideas-of-stuff-to-learn.github.io"]
print(f"[startup] LOCAL_DEV={LOCAL_DEV}, CORS_ORIGINS={CORS_ORIGINS}", flush=True)