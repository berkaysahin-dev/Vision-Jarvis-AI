import { useState, useRef, useCallback } from 'react';
import { GEMINI_CONFIG } from '../config/geminiConfig';

export type JarvisStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
export type JarvisLanguage = 'tr-TR' | 'en-US';
export type JarvisSoundType = 'wake' | 'start' | 'stop' | 'success' | 'process' | 'error';

export interface Message {
  role: 'user' | 'model';
  content: string;
}

// Studio-Quality Hardware Synthesizer using Web Audio API (Zero External Files Needed)
export const playJarvisSound = (type: JarvisSoundType) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'wake') {
      // Iron Man / JARVIS High-Tech 3-tone Crystalline Wake Chime (D5 -> A5 -> D6)
      const notes = [587.33, 880.00, 1174.66];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.045);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.15, now);
        filter.Q.setValueAtTime(2.5, now);

        const startTime = now + index * 0.045;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } else if (type === 'start') {
      // Crisp Dual-Harmonic Activation Chime (E5 -> B5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12);

      osc2.frequency.setValueAtTime(987.77, now);
      osc2.frequency.exponentialRampToValueAtTime(1975.53, now + 0.12);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
    } else if (type === 'stop') {
      // Soft Gentle Sci-Fi Deactivation / Interrupt (A5 -> D5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880.00, now);
      osc.frequency.exponentialRampToValueAtTime(440.00, now + 0.14);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'success') {
      // Bright Positive Sci-Fi Confirmation Chord (G5 + E6)
      [783.99, 1318.51].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        const st = now + idx * 0.05;
        gain.gain.setValueAtTime(0, st);
        gain.gain.linearRampToValueAtTime(0.1, st + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(st);
        osc.stop(st + 0.25);
      });
    } else if (type === 'error') {
      // Subtle Sci-Fi Warning Tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(130, now + 0.18);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch (e) {
    console.warn('[JARVIS Sound FX Error]:', e);
  }
};

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

  // Always-On Wake Word Background Listening Mode
  const [isAlwaysListening, setIsAlwaysListeningState] = useState<boolean>(() => {
    const saved = localStorage.getItem('jarvis_always_listening');
    return saved === 'true';
  });
  const isAlwaysListeningRef = useRef(isAlwaysListening);
  isAlwaysListeningRef.current = isAlwaysListening;

  const toggleAlwaysListening = useCallback(() => {
    setIsAlwaysListeningState(prev => {
      const next = !prev;
      localStorage.setItem('jarvis_always_listening', next ? 'true' : 'false');
      isAlwaysListeningRef.current = next;
      return next;
    });
  }, []);

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

  const focusAppWindow = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send('show-and-focus-window');
      } catch (e) {
        console.warn('IPC focus error:', e);
      }
    }
  }, []);

  // Clean raw AI response from VTT timestamp artifacts
  const cleanResponseText = (text: string): string => {
    return text.replace(/\d{2}:\d{2}:\d{2}\.\d+/g, '').replace(/\s+/g, ' ').trim();
  };

  const discoveredModelsRef = useRef<string[]>([]);

  // Discover actual supported models dynamically for the user's API Key with fast timeout
  const discoverAvailableModels = async (key: string): Promise<string[]> => {
    if (discoveredModelsRef.current.length > 0) {
      return discoveredModelsRef.current;
    }

    const defaultModels = GEMINI_CONFIG.MODELS;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GEMINI_CONFIG.DISCOVERY_TIMEOUT_MS || 3500);

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const supported = data.models
          .filter((m: any) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''))
          .filter((name: string) => !name.includes('embedding') && !name.includes('imagen') && !name.includes('aqa') && !name.includes('tts') && !name.includes('2.5-flash'));

        // Prioritize fast 2.0 and 1.5 flash models
        supported.sort((a: string, b: string) => {
          if (a.includes('2.0-flash') && !b.includes('2.0-flash')) return -1;
          if (b.includes('2.0-flash') && !a.includes('2.0-flash')) return 1;
          if (a.includes('flash') && !b.includes('flash')) return -1;
          if (!a.includes('flash') && b.includes('flash')) return 1;
          return 0;
        });

        if (supported.length > 0) {
          discoveredModelsRef.current = supported;
          return supported;
        }
      }
    } catch (e) {
      console.warn('[JARVIS] Fast model discovery timed out or failed, using default fast models:', e);
    }

    discoveredModelsRef.current = defaultModels;
    return defaultModels;
  };

  // Robust, Low-Latency Gemini REST Call with 8s AbortController and Fast Failover
  const callGeminiREST = async (parts: any[], sysInstruction: string) => {
    if (!apiKey) throw new Error('API Key eksik. Lütfen Ayarlar bölümünden API anahtarınızı girin.');

    let candidateModels = discoveredModelsRef.current;
    if (!candidateModels || candidateModels.length === 0) {
      candidateModels = await discoverAvailableModels(apiKey);
    }

    // Combine guaranteed stable models with discovered ones
    const prioritizedModels = Array.from(new Set([
      GEMINI_CONFIG.CHAT_MODEL,
      ...GEMINI_CONFIG.MODELS,
      ...candidateModels
    ])).filter(m => !m.includes('2.5-flash')); // Remove nonexistent experimental names

    let lastError: any = null;

    for (const model of prioritizedModels) {
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => {
        controller.abort();
      }, GEMINI_CONFIG.REQUEST_TIMEOUT_MS || 8000);

      try {
        console.log(`[Gemini REST] Connecting to model: ${model}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const bodyPayload: any = {
          contents: [{ parts: parts }],
          system_instruction: { parts: [{ text: sysInstruction }] },
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7
          }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutTimer);

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
              playJarvisSound('success');
            }
          }
          return cleanResponseText(combinedText) || 'İşlem tamamlandı.';
        }

        if (data.error) {
          console.warn(`[Gemini ${model} API Error ${data.error.code}]:`, data.error.message);
          lastError = data.error;
          // Immediate failover to next model for 503, 429, 404, etc.
          continue;
        }
      } catch (err: any) {
        clearTimeout(timeoutTimer);
        if (err.name === 'AbortError') {
          console.warn(`[Gemini ${model} Timeout (8s)] Rapid failover to next model...`);
          lastError = new Error(`Model (${model}) 8 saniye içinde yanıt vermedi.`);
        } else {
          console.warn(`[Gemini ${model} Network Exception]:`, err);
          lastError = err;
        }
        continue;
      }
    }

    if (lastError) {
      console.error('[Gemini All Models Exhausted]:', lastError);
      throw new Error(lastError.message || 'Gemini servisleri şu an yoğun, lütfen bağlantınızı veya API anahtarınızı kontrol edin.');
    }

    throw new Error('Gemini API yanıt vermedi.');
  };

  // Immediate Voice Chat Stop & Interrupt System
  const stopVoiceChat = useCallback(() => {
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
    playJarvisSound('stop');
  }, []);

  // Check if spoken text is an interrupt trigger
  const isInterruptCommand = (text: string): boolean => {
    const clean = text.toLowerCase().trim();
    const interruptWords = [
      'dur', 'sus', 'jarvis dur', 'sohbeti durdur', 'sesi kes', 
      'iptal', 'yeter', 'kapat', 'tamam sus', 'stop', 'konuşma', 'sessiz ol'
    ];
    return interruptWords.some(w => clean === w || clean.startsWith(w + ' ') || clean.endsWith(' ' + w));
  };

  // Check if spoken text contains Wake Word
  const checkWakeWord = (text: string): { isWake: boolean; command: string } => {
    const clean = text.toLowerCase().trim();
    const wakePatterns = [
      /^hey\s+jarvis[\s,]*/i,
      /^ey\s+jarvis[\s,]*/i,
      /^merhaba\s+jarvis[\s,]*/i,
      /^jarvis\s+uyan[\s,]*/i,
      /^jarvis[\s,]*/i,
      /^cervis[\s,]*/i
    ];

    for (const pattern of wakePatterns) {
      if (pattern.test(clean)) {
        const remaining = clean.replace(pattern, '').trim();
        return { isWake: true, command: remaining };
      }
    }

    if (clean === 'jarvis' || clean === 'hey jarvis' || clean === 'cervis') {
      return { isWake: true, command: '' };
    }

    return { isWake: false, command: text };
  };

  // Fast Real-Time Speech Recognition with Wake Word Detection & 380ms Silence Cutoff
  const startListening = async () => {
    if (!apiKey) {
      setErrorMessage(language === 'tr-TR' ? 'Lütfen önce API anahtarını girin.' : 'Please enter API key first.');
      setStatus('error');
      playJarvisSound('error');
      return;
    }

    if (isMuted) {
      setErrorMessage(language === 'tr-TR' ? 'Mikrofon kapalı (Sessizde). Lütfen önce mikrofonu açın.' : 'Microphone is muted.');
      setStatus('error');
      playJarvisSound('error');
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
    playJarvisSound('start');
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
            console.log('[JARVIS Live Transcript]:', currentWords);
            latestTranscriptRef.current = currentWords;

            // 1. Direct Interrupt Detection
            if (isInterruptCommand(currentWords)) {
              console.log('[JARVIS Interrupt Triggered]:', currentWords);
              stopVoiceChat();
              return;
            }

            // 2. Wake Word Detection -> Bring App Window to Front
            const wakeCheck = checkWakeWord(currentWords);
            if (wakeCheck.isWake) {
              console.log('[JARVIS Wake Word Detected! Focusing Window]:', currentWords);
              focusAppWindow();
              playJarvisSound('wake');
            }

            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            // If final result ready: trigger in 50ms; if interim: trigger after 380ms of silence
            const debounceMs = hasFinal ? 50 : 380;
            silenceTimerRef.current = setTimeout(async () => {
              const textToSend = latestTranscriptRef.current;
              if (textToSend && status === 'listening') {
                console.log('[JARVIS Fast VAD Executing]:', textToSend);
                stopListening();

                const wakeData = checkWakeWord(textToSend);
                if (wakeData.isWake) {
                  focusAppWindow();
                  if (!wakeData.command) {
                    // Spoken only "Jarvis" -> Greet and be ready
                    const reply = language === 'tr-TR' ? 'Dinliyorum efendim, buyrun.' : 'Yes sir, I am listening.';
                    setConversation(prev => [
                      ...prev,
                      { role: 'user', content: textToSend },
                      { role: 'model', content: reply }
                    ]);
                    speakText(reply);
                    return;
                  }
                  // Spoken "Jarvis [command]" -> execute command
                  await sendTextMessage(wakeData.command);
                } else {
                  await sendTextMessage(textToSend);
                }
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
          if (isAlwaysListeningRef.current && !isMuted) {
            setTimeout(() => {
              try {
                if (isAlwaysListeningRef.current && status !== 'speaking' && status !== 'processing') {
                  recognition.start();
                }
              } catch(e) {}
            }, 300);
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
    playJarvisSound('stop');

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
      playJarvisSound('error');
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
      playJarvisSound('error');
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
      playJarvisSound('error');
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
            if (isAlwaysListeningRef.current && !isMuted) {
              setTimeout(() => {
                if (isAlwaysListeningRef.current) startListening();
              }, 400);
            }
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
        if (isAlwaysListeningRef.current && !isMuted) {
          setTimeout(() => {
            if (isAlwaysListeningRef.current) startListening();
          }, 400);
        }
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
    isAlwaysListening,
    toggleAlwaysListening,
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
    playJarvisSound,
    focusAppWindow,
  };
}
