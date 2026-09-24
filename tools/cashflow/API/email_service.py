"""
email_service.py

Single reusable send_email() function used by all outbound email flows:
  - Email verification  (Task 3)
  - Password reset      (Task 4)
  - Welcome email       (optional, low priority)

Reads SMTP credentials from environment variables. Set
DISABLE_EMAIL_SENDING=true in .env to log instead of sending
(useful for local dev without burning quota).
"""
import os
import smtplib
import ssl
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

_SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
_SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
_SMTP_USER = os.environ.get('SMTP_USER', '')
_SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
_DISABLE = os.environ.get('DISABLE_EMAIL_SENDING', 'false').lower() == 'true'


def send_email(to_address, subject, html_body, text_body=None):
    """Send a transactional email.

    Args:
        to_address:  recipient email string
        subject:     email subject line
        html_body:   HTML content (primary)
        text_body:   plain-text fallback (optional; auto-stripped from html if omitted)

    Raises:
        RuntimeError if SMTP credentials are not configured
        smtplib.SMTPException on delivery failure
    """
    if _DISABLE:
        logger.info(
            'Email sending disabled. Would have sent: to=%s subject=%s',
            to_address, subject
        )
        return

    if not _SMTP_USER or not _SMTP_PASSWORD:
        raise RuntimeError(
            'SMTP credentials not configured — set SMTP_USER and SMTP_PASSWORD in .env'
        )

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = _SMTP_USER
    msg['To'] = to_address

    if text_body:
        msg.attach(MIMEText(text_body, 'plain'))
    msg.attach(MIMEText(html_body, 'html'))

    context = ssl.create_default_context()
    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT, timeout=15) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(_SMTP_USER, _SMTP_PASSWORD)
        server.sendmail(_SMTP_USER, to_address, msg.as_string())

    logger.info('Email sent: to=%s subject=%s', to_address, subject)
