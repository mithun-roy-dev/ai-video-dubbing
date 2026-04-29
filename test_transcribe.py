import requests, os, wave, struct, io, base64

key = ''
try:
    with open('.env') as f:
        for line in f:
            if line.startswith('VITE_OPENROUTER_API_KEY'):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
except Exception as e:
    print('Error reading .env:', e)

# Create a minimal valid WAV file
buf = io.BytesIO()
with wave.open(buf, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
    w.writeframes(struct.pack('<' + 'h' * 16000, *([100] * 16000)))
wav_bytes = buf.getvalue()
b64_audio = base64.b64encode(wav_bytes).decode()

print('=== Test: JSON with input_audio object ===')
resp = requests.post(
    'https://openrouter.ai/api/v1/audio/transcriptions',
    headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
    json={
        'model': 'openai/whisper-1',
        'input_audio': {
            'data': b64_audio,
            'format': 'wav'
        }
    },
    timeout=30
)
print(f'Status: {resp.status_code}')
print(f'Response: {resp.text[:600]}')

print('\n=== Test: JSON with input_audio + language ===')
resp2 = requests.post(
    'https://openrouter.ai/api/v1/audio/transcriptions',
    headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
    json={
        'model': 'openai/whisper-1',
        'input_audio': {
            'data': b64_audio,
            'format': 'wav'
        },
        'language': 'hi'
    },
    timeout=30
)
print(f'Status: {resp2.status_code}')
print(f'Response: {resp2.text[:600]}')
