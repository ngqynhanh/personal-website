# personal-website

## Contact form email

The contact form posts to a local `/api/contact` endpoint instead of a third-party relay.

To make it send mail:

1. Copy `.env.example` to `.env` and fill in your SMTP details.
2. Run `npm install`.
3. Start the site with `npm start`.

The server serves the static site and sends messages to `CONTACT_TO` using the SMTP account in `SMTP_USER` and `SMTP_PASS`.
