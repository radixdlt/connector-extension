import os
import json
import urllib.parse
import urllib.request
import urllib.error

from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
AUTH_CODE = os.environ["GOOGLE_AUTH_CODE"]


def exchange_code_for_token():
    data = urllib.parse.urlencode(
        {
            "client_id": CLIENT_ID.strip(),
            "client_secret": CLIENT_SECRET.strip(),
            "code": AUTH_CODE.strip(),
            "grant_type": "authorization_code",
            "redirect_uri": "http://localhost:8818",
        }
    ).encode()

    req = urllib.request.Request(
        "https://accounts.google.com/o/oauth2/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        result = json.loads(e.read())

    print(json.dumps(result, indent=2))

    if "error" not in result:
        print(f"\nRefresh token:\n{result['refresh_token']}")
    else:
        print(f"\nError: {result['error']} - {result.get('error_description', '')}")


if __name__ == "__main__":
    exchange_code_for_token()
