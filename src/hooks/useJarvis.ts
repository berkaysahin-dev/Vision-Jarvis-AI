import { useState, useRef } from 'react';
import { GEMINI_CONFIG } from '../config/geminiConfig';

export type JarvisStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
export type JarvisLanguage = 'tr-TR' | 'en-US';

export interface Message {
  role: 'user' | 'model';
  content: string;
}

export function useJarvis(apiKey: string, language: JarvisLanguage = 'tr-TR') {
  const [status, setStatus] = useState<JarvisStatus>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  // Voice Customization (Pitch & Rate)
  const [voicePitch, setVoicePitchState] = useState<number>(() => {
    const saved = localStorage.getItem('jarvis_voice_pitch');
    return saved ? parseFloat(saved) : 0.95;
  });

  const [voiceRate, setVoiceRateState] = useState<number>(() => {
    const saved = localStorage.getItem('jarvis_voice_rate');
    return saved ? parseFloat(saved) : 1.0;
  });

  const setVoicePitch = (val: number) => {
    setVoicePitchState(val);
    localStorage.setItem('jarvis_voice_pitch', val.toString());
  };

  const setVoiceRate = (val: number) => {
    setVoiceRateState(val);
    localStorage.setItem('jarvis_voice_rate', val.toString());
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const maxTimeoutRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  // Auto Voice Silence Detection Refs
  const hasSpokenRef = useRef(false);
  const lastSoundTimeRef = useRef<number>(0);
  const isStoppingRef = useRef(false);

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (next && status === 'listening') {
        stopListening();
      }
      return next;
    });
  };

  const playSoundEffect = (type: 'start' | 'stop') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      if (type === 'start') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch(e) {
      console.warn("Sound effect error", e);
    }
  };

  const executeSystemTool = async (name: string, args: any) => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const res = await ipcRenderer.invoke('execute-tool', { name, args });
        console.log('[JARVIS Tool Executed]:', res);
        return res;
      } catch (e) {
        console.error('IPC Tool error:', e);
      }
    }
    return 'Fonksiyon çalıştırılamadı.';
  };

  // Clean raw AI response from VTT timestamp artifacts like 00:00:03.486000
  const cleanResponseText = (text: string): string => {
    return text.replace(/\d{2}:\d{2}:\d{2}\.\d+/g, '').replace(/\s+/g, ' ').trim();
  };

  const callGeminiREST = async (parts: any[], sysInstruction: string) => {
    if (!apiKey) throw new Error('API Key eksik.');

    const model = GEMINI_CONFIG.CHAT_MODEL;
    console.log(`[Gemini REST] Calling model: ${model}`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const bodyPayload: any = {
      contents: [{ parts: parts }],
      system_instruction: { parts: [{ text: sysInstruction }] }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    const data = await res.json();

    if (res.ok && data.candidates && data.candidates[0]?.content?.parts) {
      console.log(`[Gemini REST] Connected successfully with ${model}`);
      let combinedText = '';
      for (const part of data.candidates[0].content.parts) {
        if (part.text) {
          combinedText += part.text;
        }
        if (part.functionCall) {
          const toolResult = await executeSystemTool(part.functionCall.name, part.functionCall.args);
          setConversation(prev => [
            ...prev,
            { role: 'model', content: `⚙️ [Sistem Aksiyonu]: ${toolResult}` }
          ]);
        }
      }
      return cleanResponseText(combinedText) || 'İşlem tamamlandı.';
    }

    if (data.error) {
      console.error(`[Gemini REST Error]:`, data.error);
      throw new Error(data.error.message || 'Gemini bağlantı hatası.');
    }

    throw new Error('Gemini API yanıt vermedi.');
  };

  const startListening = async () => {
    if (!apiKey) {
      setErrorMessage(language === 'tr-TR' ? 'Lütfen önce API anahtarını girin.' : 'Please enter API key first.');
      setStatus('error');
      return;
    }

    if (isMuted) {
      setErrorMessage(language === 'tr-TR' ? 'Mikrofon kapalı (Sessizde). Lütfen önce mikrofonu açın.' : 'Microphone is muted.');
      setStatus('error');
      return;
    }
    
    setErrorMessage('');
    playSoundEffect('start');
    setStatus('listening');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        console.log('[JARVIS] Starting Web Speech Recognition API...');
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = language;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = async (event: any) => {
          const transcript = event.results[0]?.[0]?.transcript;
          console.log('[JARVIS Speech Recognition Transcript]:', transcript);
          if (transcript) {
            playSoundEffect('stop');
            await sendTextMessage(transcript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[JARVIS Speech Recognition Error]:', event.error);
          fallbackMediaRecorder();
        };

        recognition.onend = () => {
          if (status === 'listening') {
            setStatus('idle');
          }
        };

        recognition.start();
        return;
      } catch (e) {
        console.warn('[JARVIS Speech Recognition Exception, falling back]:', e);
      }
    }

    fallbackMediaRecorder();
  };

  const fallbackMediaRecorder = async () => {
    audioChunksRef.current = [];
    hasSpokenRef.current = false;
    isStoppingRef.current = false;
    lastSoundTimeRef.current = Date.now();

    try {
      console.log('[JARVIS] Requesting MediaRecorder fallback...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType ? mimeType : undefined });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[JARVIS] MediaRecorder stopped. Processing audio...');
        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        
        stream.getTracks().forEach(track => track.stop());

        if (audioBlob.size === 0) {
          setStatus('error');
          setErrorMessage('Mikrofondan ses alınamadı.');
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = reader.result as string;
          const base64Audio = base64Data.split(',')[1];
          await sendAudioToGemini(base64Audio, actualMimeType);
        };
        reader.onerror = () => {
          setStatus('error');
          setErrorMessage('Ses dosyası okunamadı.');
        };
      };

      mediaRecorder.start(500);

      // Auto Voice Silence Detection (VAD)
      audioCtxRef.current = new AudioContext();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (mediaRecorder.state === 'recording') {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
          const level = (sum / dataArray.length) / 255;
          setAudioLevel(level);

          const now = Date.now();
          if (level > 0.08) {
            hasSpokenRef.current = true;
            lastSoundTimeRef.current = now;
          }

          if (hasSpokenRef.current && (now - lastSoundTimeRef.current > 1200) && !isStoppingRef.current) {
            console.log('[JARVIS VAD] Auto-detected end of speech. Stopping...');
            isStoppingRef.current = true;
            stopListening();
            return;
          }

          requestAnimationFrame(updateLevel);
        } else {
          setAudioLevel(0);
        }
      };
      updateLevel();

      if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording' && !isStoppingRef.current) {
          isStoppingRef.current = true;
          stopListening();
        }
      }, 10000);

    } catch (e: any) {
      console.error('[JARVIS] Microphone error:', e);
      setStatus('error');
      setErrorMessage(language === 'tr-TR' ? `Mikrofon Hatası: ${e.message}` : `Mic Error: ${e.message}`);
    }
  };

  const stopListening = () => {
    if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
    playSoundEffect('stop');

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setStatus('processing');
      mediaRecorderRef.current.stop();
    } else {
      if (status === 'listening') {
        setStatus('idle');
      }
    }
  };

  const checkForSystemCommands = async (text: string) => {
    const lower = text.toLowerCase();
    
    // Application Opening Triggers
    if (lower.includes('chrome') || lower.includes('tarayıcı') || lower.includes('browser') || lower.includes('google') || lower.includes('internet')) {
      await executeSystemTool('open_app', { appName: 'chrome' });
    } else if (lower.includes('youtube')) {
      await executeSystemTool('open_app', { appName: 'youtube' });
    } else if (lower.includes('spotify')) {
      await executeSystemTool('open_app', { appName: 'spotify' });
    } else if (lower.includes('hesap makinesi') || lower.includes('calc')) {
      await executeSystemTool('open_app', { appName: 'calc' });
    } else if (lower.includes('not defteri') || lower.includes('notepad')) {
      await executeSystemTool('open_app', { appName: 'notepad' });
    } else if (lower.includes('vscode') || lower.includes('code aç')) {
      await executeSystemTool('open_app', { appName: 'code' });
    }

    // Media Control Triggers
    if (lower.includes('müziği durdur') || lower.includes('müziği başlat') || lower.includes('şarkıyı geç') || lower.includes('sonraki şarkı') || lower.includes('sesi yükselt') || lower.includes('sesi kıs')) {
      let action = 'playpause';
      if (lower.includes('geç') || lower.includes('sonraki')) action = 'next';
      else if (lower.includes('yükselt')) action = 'volup';
      else if (lower.includes('kıs')) action = 'voldown';
      await executeSystemTool('control_media', { action });
    }

    // Hands-Free File / Folder Search Triggers
    if (lower.includes('dosyasını aç') || lower.includes('klasörünü aç') || lower.includes('indirilenlerdeki') || lower.includes('masaüstündeki') || lower.includes('belgelerdeki')) {
      let targetFolder = '';
      if (lower.includes('indirilen')) targetFolder = 'downloads';
      else if (lower.includes('masaüstü')) targetFolder = 'desktop';
      else if (lower.includes('belge')) targetFolder = 'documents';

      const words = lower.split(' ');
      const query = words.find(w => w.length > 3 && !['aç', 'dosyasını', 'klasörünü', 'indirilenlerdeki', 'masaüstündeki', 'belgelerdeki'].includes(w)) || '';
      if (query) {
        await executeSystemTool('search_file', { fileName: query, targetFolder });
      }
    }

    // Voice Notes Triggers
    if (lower.startsWith('not al') || lower.startsWith('not ekle')) {
      const noteContent = text.replace(/^(not al|not ekle)/gi, '').trim();
      if (noteContent) {
        await executeSystemTool('save_note', { text: noteContent });
      }
    }

    // Smart Voice Reminder & Timer Triggers
    if (lower.includes('hatırlat') || lower.includes('zamanlayıcı')) {
      let delaySeconds = 10;
      const secMatch = lower.match(/(\d+)\s*saniye/);
      const minMatch = lower.match(/(\d+)\s*dakika/);

      if (secMatch) delaySeconds = parseInt(secMatch[1], 10);
      else if (minMatch) delaySeconds = parseInt(minMatch[1], 10) * 60;

      const title = text.replace(/(\d+)\s*(saniye|dakika)\s*sonra/gi, '').replace(/(hatırlat|zamanlayıcı)/gi, '').trim() || 'Hatırlatma';
      await executeSystemTool('set_reminder', { title, delaySeconds });
    }
  };

  const sendAudioToGemini = async (base64Audio: string, mimeType: string) => {
    setStatus('processing');
    setErrorMessage('');

    try {
      const sysInstruction = language === 'tr-TR' 
        ? "Sen JARVIS adında gelişmiş bir yapay zeka asistanısın. Kullanıcının bilgisayarında tarayıcı, uygulama açma, dosya arama ve zamanlayıcı başlatma yetkin VARDIR. Yanıtların Türkçe, doğal, akıcı ve kısa olmalı."
        : "You are JARVIS, an advanced AI assistant. Your responses should be natural, intelligent, and concise.";

      const cleanMime = (mimeType || 'audio/webm').split(';')[0];

      const parts = [
        { text: "Ses kaydımı dinle, isteğimi yerine getir ve Türkçe yanıtla." },
        { inline_data: { mime_type: cleanMime, data: base64Audio } }
      ];

      const rawText = await callGeminiREST(parts, sysInstruction);
      const text = cleanResponseText(rawText);

      await checkForSystemCommands(text);

      setConversation(prev => [
        ...prev, 
        { role: 'user', content: '🎤 [Sesli Mesaj]' },
        { role: 'model', content: text }
      ]);
      setCurrentResponse(text);
      setStatus('speaking');

      if (text) {
        speakText(text);
      }

    } catch (error: any) {
      console.error('[JARVIS] Audio Gemini Error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Gemini bağlantı hatası.');
      setCurrentResponse('');
    }
  };

  const sendTextMessage = async (text: string) => {
    if (!text.trim()) return;

    setConversation(prev => [...prev, { role: 'user', content: text }]);
    setStatus('processing');
    setErrorMessage('');

    try {
      const sysInstruction = language === 'tr-TR' 
        ? "Sen JARVIS adında gelişmiş bir yapay zeka asistanısın. Kullanıcının bilgisayarında tarayıcı, uygulama açma, dosya arama ve zamanlayıcı başlatma yetkin VARDIR. Yanıtların Türkçe, doğal, akıcı ve kısa olmalı."
        : "You are JARVIS. Respond intelligently and concisely.";

      const parts = [{ text: text }];

      await checkForSystemCommands(text);

      const rawAnswer = await callGeminiREST(parts, sysInstruction);
      const answer = cleanResponseText(rawAnswer);

      setConversation(prev => [...prev, { role: 'model', content: answer }]);
      setCurrentResponse(answer);
      setStatus('speaking');
      speakText(answer);

    } catch (error: any) {
      console.error('[JARVIS] Text Gemini Error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Gemini bağlantı hatası.');
    }
  };

  const sendImageToGemini = async (base64Image: string, promptText: string) => {
    setStatus('processing');
    setErrorMessage('');

    try {
      const sysInstruction = "Sen JARVIS adında görsel analizi yapabilen bir asistansın. Ekrandaki/kameradaki görüntüyü Türkçe incele ve özetle.";
      
      const parts = [
        { text: promptText || "Bu görüntüde ne var? Detaylıca açıkla." },
        { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
      ];

      const rawText = await callGeminiREST(parts, sysInstruction);
      const text = cleanResponseText(rawText);
      
      setConversation(prev => [
        ...prev, 
        { role: 'user', content: '📷 [Kamera Görüntüsü]' },
        { role: 'model', content: text }
      ]);
      setCurrentResponse(text);
      setStatus('speaking');
      speakText(text);

    } catch (e: any) {
      console.error('[JARVIS] Vision Gemini Error:', e);
      setStatus('error');
      setErrorMessage(e.message || 'Kamera/Görsel Hatası.');
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.pitch = voicePitch;
      utterance.rate = voiceRate;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.lang.startsWith('tr') && (v.name.includes('Google') || v.name.includes('Tolga') || v.name.includes('Natural') || v.name.includes('Male'))
      ) || voices.find(v => v.lang.startsWith('tr'));

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => setStatus('speaking');
      utterance.onend = () => setStatus('idle');
      utterance.onerror = () => setStatus('idle');

      window.speechSynthesis.speak(utterance);
    } else {
      setStatus('idle');
    }
  };

  return {
    status,
    audioLevel,
    conversation,
    currentResponse,
    errorMessage,
    isMuted,
    voicePitch,
    setVoicePitch,
    voiceRate,
    setVoiceRate,
    toggleMute,
    startListening,
    stopListening,
    sendTextMessage,
    sendImageToGemini,
  };
}
