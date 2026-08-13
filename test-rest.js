import fs from 'fs';

const configPath = 'C:\\Users\\BERKAY ŞAHİN\\Desktop\\Windows - JARVIS V3 - Açık Kaynak\\sistem\\config\\api_keys.json';
const conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const key = conf.gemini_api_key;

const body = JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] });

async function testV1Alpha(model) {
  const url = `https://generativelanguage.googleapis.com/v1alpha/models/${model}:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const data = await res.json();
    console.log(`v1alpha MODEL [${model}]: HTTP ${res.status}`, JSON.stringify(data));
  } catch (err) {
    console.error(`v1alpha MODEL [${model}] ERROR:`, err.message);
  }
}

async function run() {
  await testV1Alpha('gemini-2.5-flash-native-audio-latest');
  await testV1Alpha('gemini-1.5-flash');
}

run();
