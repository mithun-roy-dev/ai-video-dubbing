import requests

url = "https://openrouter.ai/api/v1/audio/speech"
headers = {"Authorization": f"Bearer invalid_key_here", "Content-Type": "application/json"}
payload = {
    "model": "openai/gpt-4o-mini-tts-2025-12-15",
    "input": "Hello",
    "voice": "alloy"
}

resp = requests.post(url, json=payload, headers=headers)
print(resp.status_code, resp.text[:200])
