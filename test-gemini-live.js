import WebSocket from 'ws';
import fs from 'fs';

const configPath = 'C:\\Users\\BERKAY ŞAHİN\\Desktop\\Windows - JARVIS V3 - Açık Kaynak\\sistem\\config\\api_keys.json';
let apiKey = '';

try {
  const conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  apiKey = conf.gemini_api_key;
} catch (e) {
  console.error('Config read error:', e);
}

console.log('[Gemini] API key detected');
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';
console.log(`[Gemini] Model: ${LIVE_MODEL}`);
console.log('[Gemini] Connecting...');

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
    console.log('[Gemini] Connected successfully');
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
