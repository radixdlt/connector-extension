# Chrome Web Store - Generate Refresh Token

Generate a Google OAuth refresh token for publishing the extension to the Chrome Web Store via CI.

## Prerequisites

- Python 3 with `python-dotenv` installed (`pip install python-dotenv`)
- Access to the Google Cloud project that owns the OAuth client
- The Google account used must have **publisher/editor access** to the extension in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

## Steps

### 1. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the [Google Cloud Console](https://console.cloud.google.com/) under **APIs & Services > Clients**.

### 2. Get an authorization code

Make sure `http://localhost:8818` is listed as an **Authorized redirect URI** in the Google Cloud Console OAuth client settings.

Open the following URL in your browser, replacing `YOUR_CLIENT_ID` with your actual client ID:

```
https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:8818&access_type=offline&prompt=consent
```

After authorizing, the browser will redirect to `http://localhost:8818/?code=XXXX&scope=...`. Copy the `code` value from the URL.

### 3. Exchange for refresh token

Paste the authorization code into `.env` as `GOOGLE_AUTH_CODE`, then run:

```bash
python3 get_refresh_token.py
```

The script will output the refresh token. Update this value in AWS Secrets Manager (`GOOGLE_REFRESH_TOKEN`).

> **Note:** Authorization codes are single-use and expire within a few minutes. If you get an `invalid_grant` error, repeat step 2 to get a fresh code and run the script immediately.
