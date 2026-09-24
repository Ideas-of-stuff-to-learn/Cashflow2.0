"""
email_service.py

Single reusable send_email() function used by all outbound email flows:
  - Email verification  (Task 3)
  - Password reset      (Task 4)
  - Welcome email       (optional, low priority)

Uses the Brevo transactional email API (HTTPS) — SMTP is blocked on Render.
Set DISABLE_EMAIL_SENDING=true in .env to log instead of sending.
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)

_BREVO_API_KEY    = os.environ.get('BREVO_API_KEY', '')
_SENDER_EMAIL     = os.environ.get('BREVO_SENDER_EMAIL', '')
_SENDER_NAME      = os.environ.get('BREVO_SENDER_NAME', 'utility-tools')
_DISABLE          = os.environ.get('DISABLE_EMAIL_SENDING', 'false').lower() == 'true'

_BREVO_URL = 'https://api.brevo.com/v3/smtp/email'


def send_email(to_address, subject, html_body, text_body=None, cc_address=None):
    """Send a transactional email via Brevo API.

    Raises:
        RuntimeError if credentials are not configured
        requests.HTTPError on API rejection
    """
    if _DISABLE:
        logger.info('Email sending disabled. Would have sent: to=%s subject=%s cc=%s', to_address, subject, cc_address)
        return

    if not _BREVO_API_KEY or not _SENDER_EMAIL:
        raise RuntimeError('Brevo credentials not configured — set BREVO_API_KEY and BREVO_SENDER_EMAIL')

    payload = {
        'sender':  {'name': _SENDER_NAME, 'email': _SENDER_EMAIL},
        'to':      [{'email': to_address}],
        'subject': subject,
        'htmlContent': html_body,
    }
    if text_body:
        payload['textContent'] = text_body
    if cc_address and cc_address != to_address:
        payload['cc'] = [{'email': cc_address}]

    resp = requests.post(
        _BREVO_URL,
        json=payload,
        headers={
            'api-key': _BREVO_API_KEY,
            'Content-Type': 'application/json',
        },
        timeout=15,
    )
    resp.raise_for_status()
    logger.info('Email sent: to=%s subject=%s', to_address, subject)
