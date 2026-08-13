import fs from 'fs';

const configPath = 'C:\\Users\\BERKAY ŞAHİN\\Desktop\\Windows - JARVIS V3 - Açık Kaynak\\sistem\\config\\api_keys.json';
const conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const key = conf.gemini_api_key;

const body = JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] });

async function testREST(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const data = await res.json();
    console.log(`TEST [${model}]: HTTP ${res.status}`, data.candidates ? 'SUCCESS!' : data.error?.message);
  } catch (err) {
    console.error(`TEST [${model}] ERROR:`, err.message);
  }
}

async function run() {
  await testREST('gemini-2.5-flash');
  await testREST('gemini-3.6-flash');
  await testREST('gemini-flash-latest');
}

run();
