"""
routes/health.py

Trivial liveness check - no auth, no rate limit, just "is the process
up." Used by Render (or whatever's monitoring the deploy) to tell a
crashed worker from a slow one.
"""
from flask import jsonify

from extensions import app


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


