const apiKey = process.env.GEMINI_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('Error: GEMINI_API_KEY is not set. Provide it via environment variable or command line argument.');
  console.log('Usage: node scripts/list-models.js <YOUR_GEMINI_API_KEY>');
  process.exit(1);
}

async function listAllModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.models) {
      const list = data.models.map(m => ({ name: m.name, methods: m.supportedGenerationMethods }));
      console.log('AVAILABLE GEMINI MODELS:', JSON.stringify(list, null, 2));
    } else {
      console.log('RESPONSE:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('Error fetching models:', err.message);
  }
}

listAllModels();
