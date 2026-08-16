import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

LOCAL_DEV = os.environ.get('VITE_LOCAL_DEV', 'false').lower() == 'true'
LOCAL_IP = os.environ.get('LOCAL_IP', '')
CORS_ORIGINS = [f"http://{LOCAL_IP}:5173"] if LOCAL_DEV and LOCAL_IP else ["https://ideas-of-stuff-to-learn.github.io"]
print(f"[startup] LOCAL_DEV={LOCAL_DEV}, LOCAL_IP={LOCAL_IP}, CORS_ORIGINS={CORS_ORIGINS}", flush=True)
