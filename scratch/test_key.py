import requests
import json

api_key = "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"
print(f"Testing key: {api_key[:10]}...")

url = "https://openrouter.ai/api/v1/auth/key"
headers = {"Authorization": f"Bearer {api_key}"}

resp = requests.get(url, headers=headers)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text}")
