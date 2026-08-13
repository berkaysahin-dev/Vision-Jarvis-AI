import fs from 'fs';

const configPath = 'C:\\Users\\BERKAY ŞAHİN\\Desktop\\Windows - JARVIS V3 - Açık Kaynak\\sistem\\config\\api_keys.json';
const conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const key = conf.gemini_api_key;

async function listAllModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.models) {
    const list = data.models.map(m => ({ name: m.name, methods: m.supportedGenerationMethods }));
    console.log('ALL MODELS LIST:', JSON.stringify(list, null, 2));
  } else {
    console.log('RESPONSE:', JSON.stringify(data));
  }
}

listAllModels();
