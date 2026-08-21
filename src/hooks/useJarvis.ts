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
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');

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
    if (!apiKey) throw new Error('API Key eksik. Lütfen Ayarlar bölümünden API anahtarınızı girin.');

    const candidateModels = (GEMINI_CONFIG as any).MODELS || ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        console.log(`[Gemini REST] Connecting with model: ${model}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const bodyPayload: any = {
          contents: [{ parts: parts }],
          system_instruction: { parts: [{ text: sysInstruction }] },
          generationConfig: {
            maxOutputTokens: 150,
            temperature: 0.7
          }
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
          console.warn(`[Gemini ${model} Error (${data.error.code})]:`, data.error.message);
          lastError = data.error;
          continue;
        }
      } catch (err: any) {
        console.warn(`[Gemini ${model} Network Exception]:`, err);
        lastError = err;
      }
    }

    if (lastError) {
      console.error('[Gemini All Models Exhausted]:', lastError);
      throw new Error(lastError.message || 'Gemini servisleri şu an yoğun, lütfen bir süre sonra tekrar deneyin.');
    }

    throw new Error('Gemini API yanıt vermedi.');
  };

  // Immediate Voice Chat Stop & Interrupt System
  const stopVoiceChat = () => {
    console.log('[JARVIS] Halting all voice chat and speech output...');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch(e) {}
    }

    setAudioLevel(0);
    setStatus('idle');
    playSoundEffect('stop');
  };

  // Check if spoken command is a direct interruption/silence trigger
  const isInterruptCommand = (text: string): boolean => {
    const clean = text.toLowerCase().trim();
    const interruptWords = [
      'dur', 'sus', 'jarvis dur', 'sohbeti durdur', 'sesi kes', 
      'iptal', 'yeter', 'kapat', 'tamam sus', 'stop', 'konuşma', 'sessiz ol'
    ];
    return interruptWords.some(w => clean === w || clean.startsWith(w + ' ') || clean.endsWith(' ' + w));
  };

  // Fast Real-Time Speech Recognition with Immediate Silence Cutoff (380ms)
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
    
    // Stop any ongoing speech playback
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setErrorMessage('');
    playSoundEffect('start');
    setStatus('listening');
    latestTranscriptRef.current = '';

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        console.log('[JARVIS] Starting Ultra-Fast Web Speech Recognition...');
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = language;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          let hasFinal = false;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
              hasFinal = true;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          const currentWords = (final || interim).trim();
          if (currentWords) {
            console.log('[JARVIS Real-Time Live Transcript]:', currentWords);
            latestTranscriptRef.current = currentWords;

            // Direct Interrupt Detection: if user says "dur", "sus", "iptal", halt immediately!
            if (isInterruptCommand(currentWords)) {
              console.log('[JARVIS Interrupt Triggered by Voice]:', currentWords);
              stopVoiceChat();
              return;
            }

            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            // If final result ready: trigger in 50ms; if interim: trigger after 380ms of silence
            const debounceMs = hasFinal ? 50 : 380;
            silenceTimerRef.current = setTimeout(async () => {
              const textToSend = latestTranscriptRef.current;
              if (textToSend && status === 'listening') {
                console.log('[JARVIS Fast VAD Executing]:', textToSend);
                stopListening();
                await sendTextMessage(textToSend);
              }
            }, debounceMs);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[JARVIS Speech Recognition Error]:', event.error);
          if (event.error !== 'no-speech') {
            fallbackMediaRecorder();
          }
        };

        recognition.onend = () => {
          if (status === 'listening' && !latestTranscriptRef.current) {
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

      mediaRecorder.start(200);

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

          if (hasSpokenRef.current && (now - lastSoundTimeRef.current > 480) && !isStoppingRef.current) {
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
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
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
        ? "Sen JARVIS adında gelişmiş ve son derece hızlı bir yapay zeka asistanısın. Yanıtların TEK ve KISA cümle, doğrudan, net ve akıcı Türkçe olmalı. Bilgisayarda tarayıcı, uygulama açma ve arama yetkin vardır."
        : "You are JARVIS, an advanced AI assistant. Respond in a single, ultra-concise sentence.";

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

      if (text) {
        speakText(text);
      } else {
        setStatus('idle');
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

    if (isInterruptCommand(text)) {
      stopVoiceChat();
      return;
    }

    setConversation(prev => [...prev, { role: 'user', content: text }]);
    setStatus('processing');
    setErrorMessage('');

    try {
      const sysInstruction = language === 'tr-TR' 
        ? "Sen JARVIS adında gelişmiş ve son derece hızlı bir yapay zeka asistanısın. Yanıtların TEK ve KISA cümle, doğrudan, net ve akıcı Türkçe olmalı. Asla gereksiz açıklama yapma. Bilgisayarda tarayıcı, uygulama açma ve sistem kontrolü yetkin vardır."
        : "You are JARVIS. Respond in a single, ultra-concise, natural sentence.";

      const parts = [{ text: text }];

      await checkForSystemCommands(text);

      const rawAnswer = await callGeminiREST(parts, sysInstruction);
      const answer = cleanResponseText(rawAnswer);

      setConversation(prev => [...prev, { role: 'model', content: answer }]);
      setCurrentResponse(answer);
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
      const sysInstruction = "Sen JARVIS adında görsel analizi yapabilen bir asistansın. Ekrandaki/kameradaki görüntüyü Türkçe incele ve tek kısa cümlede özetle.";
      
      const parts = [
        { text: promptText || "Bu görüntüde ne var? Kısaca açıkla." },
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
      speakText(text);

    } catch (e: any) {
      console.error('[JARVIS] Vision Gemini Error:', e);
      setStatus('error');
      setErrorMessage(e.message || 'Kamera/Görsel Hatası.');
    }
  };

  // Studio-Quality Natural Human Voice Output (Edge Neural TTS + Audio Analyser for 3D Orb)
  const speakText = async (text: string) => {
    if (!text) {
      setStatus('idle');
      return;
    }

    // Clean text from markdown syntax, emojis, and hashtags for crisp natural pronunciation
    const cleanText = text
      .replace(/[*#_`~>\[\]()]/g, '')
      .replace(/\bhttps?:\/\/\S+/gi, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    if (!cleanText) {
      setStatus('idle');
      return;
    }

    setStatus('speaking');

    // 1. Try Studio Natural Human Neural Voice via Electron
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const voiceName = language === 'tr-TR' ? 'tr-TR-AhmetNeural' : 'en-US-ChristopherNeural';
        const audioBase64 = await ipcRenderer.invoke('synthesize-speech', { text: cleanText, voice: voiceName });

        if (audioBase64) {
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }

          const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
          currentAudioRef.current = audio;

          // Connect Web Audio API Analyser to drive 3D Orb visualizer in real-time
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioCtx.createMediaElementSource(audio);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyser.connect(audioCtx.destination);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateVisualizer = () => {
              if (!audio.paused && !audio.ended) {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const level = (sum / dataArray.length) / 255;
                setAudioLevel(level * 1.5);
                requestAnimationFrame(updateVisualizer);
              } else {
                setAudioLevel(0);
              }
            };

            audio.onplay = () => {
              audioCtx.resume();
              updateVisualizer();
            };
          } catch (e) {
            // Web Audio fallback
          }

          audio.onended = () => {
            setStatus('idle');
            setAudioLevel(0);
          };

          audio.onerror = () => {
            fallbackSpeechSynthesis(cleanText);
          };

          await audio.play();
          return;
        }
      } catch (e) {
        console.warn('[JARVIS Neural Voice Fallback to Web Speech]:', e);
      }
    }

    // 2. Fallback to Web Speech Synthesis
    fallbackSpeechSynthesis(cleanText);
  };

  const fallbackSpeechSynthesis = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.pitch = voicePitch;
      utterance.rate = voiceRate;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.lang.startsWith('tr') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Tolga') || v.name.includes('Male'))
      ) || voices.find(v => v.lang.startsWith('tr'));

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => setStatus('speaking');
      utterance.onend = () => {
        setStatus('idle');
        setAudioLevel(0);
      };
      utterance.onerror = () => {
        setStatus('idle');
        setAudioLevel(0);
      };

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
    stopVoiceChat,
    sendTextMessage,
    sendImageToGemini,
  };
}
