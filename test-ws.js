const WebSocket = require('ws');
const apiKey = process.env.GEMINI_API_KEY || ''; // I will provide it via terminal

const HOST = 'generativelanguage.googleapis.com';
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('WS Open. Sending setup...');
  const setupMessage = {
    setup: {
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: ["AUDIO"]
      }
    }
  };
  ws.send(JSON.stringify(setupMessage));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
  // After setup completes, send a test clientContent
  const msg = JSON.parse(data.toString());
  if (msg.setupComplete) {
    console.log('Setup complete, sending text turn...');
    ws.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text: "Hello" }]
        }],
        turnComplete: true
      }
    }));
  }
});

ws.on('error', (err) => console.error('Error:', err));
ws.on('close', (code, reason) => console.log('Closed', code, reason.toString()));
