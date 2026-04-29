import requests, os

key = ''
try:
    with open('.env') as f:
        for line in f:
            if line.startswith('VITE_OPENROUTER_API_KEY'):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
except Exception as e:
    print('Error reading .env:', e)

url = "https://openrouter.ai/api/v1/audio/speech"
headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
payload = {
    "model": "openai/gpt-4o-mini-tts-2025-12-15",
    "input": "Hello",
    "voice": "alloy"
}

resp = requests.post(url, json=payload, headers=headers)
print(resp.status_code, resp.text[:200])
