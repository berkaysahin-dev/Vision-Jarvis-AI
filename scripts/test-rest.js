const apiKey = process.env.GEMINI_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('Error: GEMINI_API_KEY is not set. Provide it via environment variable or command line argument.');
  console.log('Usage: node scripts/test-rest.js <YOUR_GEMINI_API_KEY>');
  process.exit(1);
}

const body = JSON.stringify({
  contents: [{ parts: [{ text: 'Hello, JARVIS test connection.' }] }]
});

async function testModel(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const data = await res.json();
    console.log(`[${model}] Status: HTTP ${res.status}`);
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      console.log(`[${model}] Output:`, data.candidates[0].content.parts[0].text.trim());
    } else {
      console.log(`[${model}] Response:`, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`[${model}] Error:`, err.message);
  }
}

async function run() {
  await testModel('gemini-2.5-flash');
}

run();
