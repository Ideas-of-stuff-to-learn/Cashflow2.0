"""
routes/transactions/__init__.py

Importing each submodule here is what makes their @app.route(...)
decorators actually execute and register with the shared `app` -
backend.py's `import routes.transactions` still works completely
unchanged, since Python resolves that to this __init__.py, which in
turn triggers all three submodules' route registration.
"""
from . import upload
from . import crud
from . import categorisation_routes