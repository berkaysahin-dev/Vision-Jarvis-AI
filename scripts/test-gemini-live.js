import WebSocket from 'ws';

const apiKey = process.env.GEMINI_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('Error: GEMINI_API_KEY is not set. Provide it via environment variable or command line argument.');
  console.log('Usage: node scripts/test-gemini-live.js <YOUR_GEMINI_API_KEY>');
  process.exit(1);
}

console.log('[Gemini] API key detected');
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';
console.log(`[Gemini] Testing Model: ${LIVE_MODEL}`);
console.log('[Gemini] Connecting to Live Bidi WebSocket...');

const HOST = 'generativelanguage.googleapis.com';
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('[Gemini] WebSocket connection open. Sending setup payload...');
  const setupMessage = {
    setup: {
      model: `models/${LIVE_MODEL}`,
      generationConfig: {
        responseModalities: ["AUDIO"]
      }
    }
  };
  ws.send(JSON.stringify(setupMessage));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.setupComplete) {
    console.log('[Gemini] Live session connected successfully!');
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('[Gemini] Connection Error:', err.message || err);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  if (code !== 1000) {
    console.log(`[Gemini] Connection closed with code ${code}: ${reason.toString()}`);
  }
});
