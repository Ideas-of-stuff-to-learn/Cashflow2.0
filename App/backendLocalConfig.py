import os
from dotenv import load_dotenv

# Reads the SAME App/.env file the frontend's Vite config points at -
# this is what makes it genuinely one shared source, not two separate
# flags that happen to have the same value right now.
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

local = os.environ.get('VITE_LOCAL_DEV', 'false').lower() == 'true'

localIP = "http://192.168.0.101:5173"
deployBackendURL = "https://ideas-of-stuff-to-learn.github.io"

if local:
    CORS_origins = [deployBackendURL,localIP]
else:
    CORS_origins = [localIP]