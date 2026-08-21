import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Canvas } from '@react-three/fiber';
import { Orb } from './components/Orb';
import { useJarvis, type JarvisLanguage } from './hooks/useJarvis';

// Mini SVG Sparkline Component for OS Performance Gauges
function Sparkline({ data, color, height = 26, width = 85 }: { data: number[]; color: string; height?: number; width?: number }) {
  if (!data || data.length < 2) return null;
  const max = 100;
  const min = 0;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const clampedVal = Math.max(min, Math.min(max, val));
    const y = height - ((clampedVal - min) / (max - min)) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const gradId = `spark-grad-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', opacity: 0.9 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function App() {
  const [apiKey, setApiKey] = useState('');
  const [language, setLanguage] = useState<JarvisLanguage>('tr-TR');
  const [showSettings, setShowSettings] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [qrData, setQrData] = useState<{ url: string; ip: string; port: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [notes, setNotes] = useState<{ id: string; text: string; date: string }[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  
  // Real-time system performance & historical sparkline tracking
  const [systemStats, setSystemStats] = useState<{ cpuUsage: number; memUsage: number; usedMemGB: string; totalMemGB: string }>({
    cpuUsage: 12,
    memUsage: 45,
    usedMemGB: '7.2',
    totalMemGB: '16.0'
  });
  const [cpuHistory, setCpuHistory] = useState<number[]>([12, 14, 18, 15, 20, 16, 12, 19, 24, 18, 15, 12]);
  const [ramHistory, setRamHistory] = useState<number[]>([44, 45, 45, 46, 45, 46, 45, 46, 47, 46, 45, 45]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('jarvis_api_key');
    const savedLang = localStorage.getItem('jarvis_language') as JarvisLanguage;
    if (savedKey) {
      setApiKey(savedKey);
      setShowSettings(false);
    }
    if (savedLang) {
      setLanguage(savedLang);
    }
  }, []);

  const { 
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
    sendImageToGemini
  } = useJarvis(apiKey, language);

  // Global Escape Key listener to stop voice chat & speech immediately
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (status === 'speaking' || status === 'listening' || status === 'processing')) {
        stopVoiceChat();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [status, stopVoiceChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, currentResponse]);

  // IPC Event Listeners & System Stats Polling
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        
        const handleMobileCmd = (_event: any, data: any) => {
          if (data && data.text) {
            console.log('[JARVIS Mobile Command Received]:', data.text);
            sendTextMessage(data.text);
          }
        };

        const handleTriggerListening = () => {
          console.log('[JARVIS Global Hotkey Alt+Space Triggered]');
          startListening();
        };

        const handleReminderTriggered = (_event: any, data: any) => {
          console.log('[JARVIS Reminder Triggered]:', data);
        };

        ipcRenderer.on('mobile-command', handleMobileCmd);
        ipcRenderer.on('trigger-voice-listening', handleTriggerListening);
        ipcRenderer.on('reminder-triggered', handleReminderTriggered);

        // Fetch System Stats periodically & record history for sparklines
        const fetchStats = async () => {
          try {
            const stats = await ipcRenderer.invoke('get-system-stats');
            if (stats) {
              setSystemStats(stats);
              setCpuHistory(prev => [...prev.slice(1), stats.cpuUsage]);
              setRamHistory(prev => [...prev.slice(1), stats.memUsage]);
            }
          } catch(e) {}
        };
        fetchStats();
        const interval = setInterval(fetchStats, 2500);

        return () => {
          ipcRenderer.removeListener('mobile-command', handleMobileCmd);
          ipcRenderer.removeListener('trigger-voice-listening', handleTriggerListening);
          ipcRenderer.removeListener('reminder-triggered', handleReminderTriggered);
          clearInterval(interval);
        };
      } catch (e) {
        console.error('IPC Listener Error:', e);
      }
    }
  }, [sendTextMessage, startListening]);

  const openExternalLink = (url: string) => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { shell } = (window as any).require('electron');
        shell.openExternal(url);
        return;
      } catch (e) {}
    }
    window.open(url, '_blank');
  };

  const handleSaveSettings = () => {
    localStorage.setItem('jarvis_api_key', apiKey);
    localStorage.setItem('jarvis_language', language);
    setShowSettings(false);
  };

  const handleWindowControl = (action: string) => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send(`window-${action}`);
      } catch (e) {
        console.error('Electron not found');
      }
    }
  };

  const handleOpenQR = async () => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const info = await ipcRenderer.invoke('get-qr-info');
        setQrData(info);
        setShowQR(true);
      } catch (e) {
        console.error('IPC error', e);
      }
    }
  };

  const handleToggleCamera = async () => {
    if (!showCamera) {
      setShowCamera(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error('Camera access error:', e);
      }
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
      setShowCamera(false);
    }
  };

  const handleCaptureAndAnalyze = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.split(',')[1];
        sendImageToGemini(base64, "Kameradaki bu görüntüyü detaylıca analiz et ve açıkla.");
        handleToggleCamera();
      }
    }
  };

  const handleAnalyzeScreen = async () => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const dataUrl = await ipcRenderer.invoke('capture-screen');
        if (dataUrl) {
          const base64 = dataUrl.split(',')[1];
          sendImageToGemini(base64, "Ekranımdaki bu anlık görüntüyü, kodları, görselleri ve yazıları Türkçe detaylıca incele ve çözüm sun.");
        }
      } catch (e) {
        console.error('Screen capture error:', e);
      }
    }
  };

  const handleMediaControl = async (action: string) => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        await ipcRenderer.invoke('execute-tool', { name: 'control_media', args: { action } });
      } catch(e) {}
    }
  };

  const handleLoadNotes = async () => {
    setShowNotes(true);
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const notesJson = await ipcRenderer.invoke('execute-tool', { name: 'get_notes', args: {} });
        if (notesJson) setNotes(JSON.parse(notesJson));
      } catch(e) {}
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        await ipcRenderer.invoke('execute-tool', { name: 'save_note', args: { text: newNoteText } });
        setNewNoteText('');
        handleLoadNotes();
      } catch(e) {}
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        await ipcRenderer.invoke('execute-tool', { name: 'delete_note', args: { id } });
        handleLoadNotes();
      } catch(e) {}
    }
  };

  const handleOrbClick = () => {
    if (status === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      sendTextMessage(textInput);
      setTextInput('');
    }
  };

  const handleAppLaunch = (appId: string, commandText: string) => {
    setActiveApp(appId);
    sendTextMessage(commandText);
  };

  // Dynamic Center Status Details & Colors
  const getStatusDetails = () => {
    switch (status) {
      case 'listening':
        return {
          title: language === 'tr-TR' ? 'DİNLİYOR' : 'LISTENING',
          subtitle: language === 'tr-TR' ? 'VAD Ses Algılama Aktif' : 'VAD Voice Activity Active',
          color: '#007aff',
          bg: 'rgba(0, 122, 255, 0.12)',
          border: 'rgba(0, 122, 255, 0.35)',
          glow: 'rgba(0, 122, 255, 0.6)',
          icon: '🎙️'
        };
      case 'processing':
        return {
          title: language === 'tr-TR' ? 'DÜŞÜNÜYOR' : 'THINKING',
          subtitle: language === 'tr-TR' ? 'Gemini AI Modeli İşliyor' : 'Gemini AI Model Processing',
          color: '#30d158',
          bg: 'rgba(48, 209, 88, 0.12)',
          border: 'rgba(48, 209, 88, 0.35)',
          glow: 'rgba(48, 209, 88, 0.6)',
          icon: '⚡'
        };
      case 'speaking':
        return {
          title: language === 'tr-TR' ? 'KONUŞUYOR' : 'SPEAKING',
          subtitle: language === 'tr-TR' ? 'Sesli Yanıt Aktarılıyor' : 'Audio Response Active',
          color: '#ff9500',
          bg: 'rgba(255, 149, 0, 0.12)',
          border: 'rgba(255, 149, 0, 0.35)',
          glow: 'rgba(255, 149, 0, 0.6)',
          icon: '🔊'
        };
      case 'error':
        return {
          title: language === 'tr-TR' ? 'HATA' : 'ERROR',
          subtitle: language === 'tr-TR' ? 'Bağlantı Hatası' : 'Connection Error',
          color: '#ff3b30',
          bg: 'rgba(255, 59, 48, 0.15)',
          border: 'rgba(255, 59, 48, 0.4)',
          glow: 'rgba(255, 59, 48, 0.6)',
          icon: '🔴'
        };
      default:
        return {
          title: language === 'tr-TR' ? 'HAZIR' : 'READY',
          subtitle: language === 'tr-TR' ? 'Konuşmak için dokun (veya Alt+Space)' : 'Tap to speak (or Alt+Space)',
          color: '#00f0ff',
          bg: 'rgba(0, 240, 255, 0.08)',
          border: 'rgba(0, 240, 255, 0.22)',
          glow: 'rgba(0, 240, 255, 0.4)',
          icon: '●'
        };
    }
  };

  const statusInfo = getStatusDetails();

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Custom Titlebar */}
      <div className="titlebar">
        <div className="titlebar-title">JARVIS 2.0</div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={() => handleWindowControl('minimize')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button className="titlebar-btn" onClick={() => handleWindowControl('maximize')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
          </button>
          <button className="titlebar-btn close" onClick={() => handleWindowControl('close')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <header className="header" style={{ display: 'flex', gap: '12px', right: showChat ? '350px' : '16px', transition: 'right 0.3s ease', zIndex: 100 }}>
        {/* Microphone Toggle Mute Button */}
        <button 
          onClick={toggleMute}
          title={isMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}
          style={{ 
            background: isMuted ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
            border: isMuted ? '1px solid rgba(255, 59, 48, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '50%',
            padding: '6px',
            color: isMuted ? '#ff3b30' : 'var(--text-secondary)', 
            cursor: 'pointer', 
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isMuted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          )}
        </button>

        {/* Screen Capture & Vision Button */}
        <button 
          onClick={handleAnalyzeScreen}
          title="Ekranı İncele (Vision)"
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '50%', padding: '6px', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => { e.currentTarget.style.color = '#00f0ff'; e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.4)'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
        </button>

        {/* Toggle Right Chat Panel */}
        <button 
          onClick={() => setShowChat(!showChat)}
          title="Sohbet Paneli"
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '50%', padding: '6px', color: showChat ? '#00f0ff' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        {/* Camera Toggle Button */}
        <button 
          onClick={handleToggleCamera}
          title="Kamerayı Aç"
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '50%', padding: '6px', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.color = 'white'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </button>

        {/* Mobile QR Button */}
        <button 
          onClick={handleOpenQR}
          title="Telefondan Bağlan"
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '50%', padding: '6px', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.color = 'white'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
        </button>

        {/* Settings Button */}
        <button 
          onClick={() => setShowSettings(true)}
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '50%', padding: '6px', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.color = 'white'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </header>

      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ 
              position: 'absolute', top: '50px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(255, 59, 48, 0.15)', border: '1px solid rgba(255, 59, 48, 0.3)',
              backdropFilter: 'blur(12px)',
              padding: '10px 20px', borderRadius: '100px', color: '#ff3b30', zIndex: 100,
              display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              🔴 JARVIS Bağlantı Hatası
            </span>
            <span style={{ opacity: 0.8, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {errorMessage}
            </span>
            <button 
              onClick={startListening}
              style={{
                background: 'rgba(255, 59, 48, 0.25)', color: '#ff3b30',
                border: 'none', padding: '4px 12px', borderRadius: '100px',
                cursor: 'pointer', fontWeight: 600, fontSize: '12px'
              }}
            >
              Tekrar Dene
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 36px)', marginTop: '36px' }}>
        {/* Left Sidebar - Ultra-Modern Glassmorphism & OS Experience */}
        <aside className="left-sidebar">
          {/* Shaz Vision Brand Banner */}
          <div className="sidebar-brand" onClick={() => openExternalLink('https://shazvision.com')}>
            <div className="brand-badge">SHAZ VISION</div>
            <div className="brand-link">
              <span>shazvision.com</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
            </div>
          </div>

          {/* Premium OS Performance & Sparkline Metrics */}
          <div className="sidebar-section-title">Sistem & Performans</div>
          <div className="os-perf-card">
            {/* CPU Metric with Real-time Sparkline */}
            <div className="os-metric-row">
              <div className="metric-info">
                <div className="metric-title-group">
                  <span className="metric-tag">CPU</span>
                  <span className="metric-badge-status optimal">OPTIMAL</span>
                </div>
                <div className="metric-val-large" style={{ color: '#00f0ff' }}>
                  {systemStats.cpuUsage}<span>%</span>
                </div>
              </div>
              <div className="metric-sparkline-box">
                <Sparkline data={cpuHistory} color="#00f0ff" />
              </div>
            </div>

            {/* RAM Metric with Real-time Sparkline */}
            <div className="os-metric-row" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="metric-info">
                <div className="metric-title-group">
                  <span className="metric-tag">RAM</span>
                  <span className="metric-gb-sub">{systemStats.usedMemGB} / {systemStats.totalMemGB} GB</span>
                </div>
                <div className="metric-val-large" style={{ color: '#30d158' }}>
                  {systemStats.memUsage}<span>%</span>
                </div>
              </div>
              <div className="metric-sparkline-box">
                <Sparkline data={ramHistory} color="#30d158" />
              </div>
            </div>
          </div>

          {/* Modern Applications with Active Cyan Indicator & Subtitles */}
          <div className="sidebar-section-title" style={{ marginTop: '16px' }}>Uygulamalar</div>
          <div className="modern-app-list">
            {/* Chrome */}
            <button 
              className={`modern-app-btn ${activeApp === 'chrome' ? 'active' : ''}`}
              onClick={() => handleAppLaunch('chrome', 'Tarayıcıyı aç')}
            >
              <div className="active-cyan-bar" />
              <div className="app-icon-badge chrome">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              </div>
              <div className="app-meta">
                <span className="app-name">Google Chrome</span>
                <span className="app-sub">Web Tarayıcı</span>
              </div>
              {activeApp === 'chrome' && <span className="app-live-indicator" />}
            </button>

            {/* Spotify */}
            <button 
              className={`modern-app-btn ${activeApp === 'spotify' ? 'active' : ''}`}
              onClick={() => handleAppLaunch('spotify', "Spotify'ı aç")}
            >
              <div className="active-cyan-bar" />
              <div className="app-icon-badge spotify">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
              </div>
              <div className="app-meta">
                <span className="app-name">Spotify</span>
                <span className="app-sub">Müzik Çalar</span>
              </div>
              {activeApp === 'spotify' && <span className="app-live-indicator" />}
            </button>

            {/* VS Code */}
            <button 
              className={`modern-app-btn ${activeApp === 'vscode' ? 'active' : ''}`}
              onClick={() => handleAppLaunch('vscode', 'VS Code aç')}
            >
              <div className="active-cyan-bar" />
              <div className="app-icon-badge vscode">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
              </div>
              <div className="app-meta">
                <span className="app-name">VS Code</span>
                <span className="app-sub">Kod Editörü</span>
              </div>
              {activeApp === 'vscode' && <span className="app-live-indicator" />}
            </button>

            {/* Not Defteri */}
            <button 
              className={`modern-app-btn ${activeApp === 'notepad' ? 'active' : ''}`}
              onClick={() => handleAppLaunch('notepad', 'Not defterini aç')}
            >
              <div className="active-cyan-bar" />
              <div className="app-icon-badge notepad">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              </div>
              <div className="app-meta">
                <span className="app-name">Not Defteri</span>
                <span className="app-sub">Hızlı Notlar</span>
              </div>
              {activeApp === 'notepad' && <span className="app-live-indicator" />}
            </button>

            {/* Hesap Makinesi */}
            <button 
              className={`modern-app-btn ${activeApp === 'calc' ? 'active' : ''}`}
              onClick={() => handleAppLaunch('calc', 'Hesap makinesi aç')}
            >
              <div className="active-cyan-bar" />
              <div className="app-icon-badge calc">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><path d="M8 10h.01"></path><path d="M12 10h.01"></path><path d="M16 10h.01"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path></svg>
              </div>
              <div className="app-meta">
                <span className="app-name">Hesap Makinesi</span>
                <span className="app-sub">Matematik & Hesap</span>
              </div>
              {activeApp === 'calc' && <span className="app-live-indicator" />}
            </button>
          </div>

          {/* Media Player Controls */}
          <div className="sidebar-section-title" style={{ marginTop: '16px' }}>Medya Kontrolü</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            <button className="media-btn" onClick={() => handleMediaControl('playpause')} title="Oynat / Durdur">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <button className="media-btn" onClick={() => handleMediaControl('next')} title="Sonraki Şarkı">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
            </button>
            <button className="media-btn" onClick={() => handleMediaControl('volup')} title="Sesi Yükselt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
            <button className="media-btn" onClick={() => handleMediaControl('voldown')} title="Sesi Kıs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>
            </button>
          </div>

          <div className="sidebar-section-title" style={{ marginTop: '6px' }}>Hızlı Araçlar</div>
          <div className="sidebar-actions">
            <button className="sidebar-btn" onClick={handleAnalyzeScreen}>
              <span className="btn-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              </span>
              Ekran Analizi (Vision)
            </button>
            <button className="sidebar-btn" onClick={handleLoadNotes}>
              <span className="btn-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              </span>
              Sesli Notlarım
            </button>
            <button className="sidebar-btn" onClick={handleToggleCamera}>
              <span className="btn-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              </span>
              Kamera Analiz
            </button>
            <button className="sidebar-btn" onClick={handleOpenQR}>
              <span className="btn-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
              </span>
              Mobil Remote
            </button>
          </div>

          {/* Shaz Vision Signature Footer */}
          <div className="sidebar-footer" onClick={() => openExternalLink('https://shazvision.com')}>
            <div style={{ fontSize: '9px', opacity: 0.4, letterSpacing: '1px', textTransform: 'uppercase' }}>Powered By</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#00f0ff', letterSpacing: '0.8px' }}>SHAZ VISION</div>
            <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>shazvision.com</div>
          </div>
        </aside>

        {/* Main Content Area with 3D Motion Exploration Orb & Central Live Status System */}
        <main className="main-content" style={{ flex: 1, paddingBottom: 0 }}>
          <div className="ai-presence" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* Background FUI Rotating Grid & Compass Elements */}
            <div className="fui-radar-backdrop" />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Left Telemetry HUD */}
              <div className="fui-telemetry left">
                <div className="fui-item">
                  <span className="fui-label">FREQ</span>
                  <span className="fui-val">432.8 Hz</span>
                </div>
                <div className="fui-item">
                  <span className="fui-label">AUDIO FLUX</span>
                  <span className="fui-val">{Math.round(audioLevel * 100)}%</span>
                </div>
                <div className="fui-item">
                  <span className="fui-label">QUANTUM</span>
                  <span className="fui-val" style={{ color: '#00f0ff' }}>STABLE</span>
                </div>
              </div>

              {/* 3D Visualizer Orb Canvas */}
              <motion.div 
                className="orb-container"
                onClick={handleOrbClick}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                style={{ cursor: 'pointer', width: '380px', height: '380px', position: 'relative', zIndex: 2 }}
              >
                <Canvas camera={{ position: [0, 0, 4.3], fov: 46 }}>
                  <ambientLight intensity={0.6} />
                  <pointLight position={[10, 10, 10]} intensity={1.5} color="#00f0ff" />
                  <pointLight position={[-10, -10, -10]} intensity={0.8} color="#ff007f" />
                  <pointLight position={[0, 0, 5]} intensity={0.5} />
                  <Orb status={status} audioLevel={audioLevel} />
                </Canvas>
              </motion.div>

              {/* Right Telemetry HUD */}
              <div className="fui-telemetry right">
                <div className="fui-item">
                  <span className="fui-label">MODE</span>
                  <span className="fui-val">VAD_AUDIO</span>
                </div>
                <div className="fui-item">
                  <span className="fui-label">LATENCY</span>
                  <span className="fui-val">12 ms</span>
                </div>
                <div className="fui-item">
                  <span className="fui-label">PROTOCOL</span>
                  <span className="fui-val" style={{ color: '#30d158' }}>ACTIVE</span>
                </div>
              </div>
            </div>
            
            {/* Dynamic Center JARVIS Status System HUD Widget */}
            <motion.div 
              className="center-hud-status-card"
              onClick={handleOrbClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                borderColor: statusInfo.border,
                boxShadow: `0 0 24px ${statusInfo.glow}`,
                background: statusInfo.bg
              }}
            >
              <div className="hud-status-glow-dot" style={{ background: statusInfo.color, boxShadow: `0 0 10px ${statusInfo.color}` }} />
              <div className="hud-status-text-block">
                <div className="hud-status-title-row">
                  <span className="hud-status-title" style={{ color: statusInfo.color }}>
                    {statusInfo.icon} {statusInfo.title}
                  </span>
                  {(status === 'listening' || status === 'speaking') && (
                    <div className="hud-live-soundwaves">
                      <span style={{ height: `${Math.max(4, audioLevel * 18)}px`, background: statusInfo.color }} />
                      <span style={{ height: `${Math.max(6, audioLevel * 24)}px`, background: statusInfo.color }} />
                      <span style={{ height: `${Math.max(4, audioLevel * 16)}px`, background: statusInfo.color }} />
                    </div>
                  )}
                  {(status === 'speaking' || status === 'listening' || status === 'processing') && (
                    <button 
                      className="hud-stop-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        stopVoiceChat();
                      }}
                      title="Sohbeti Durdur (Escape)"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>
                      Durdur
                    </button>
                  )}
                </div>
                <span className="hud-status-subtitle">{statusInfo.subtitle}</span>
              </div>
            </motion.div>
          </div>
        </main>

        {/* Right Collapsible Chat Drawer */}
        <AnimatePresence>
          {showChat && (
            <motion.aside 
              initial={{ x: 350, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 350, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="chat-sidebar"
            >
              <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 8px #00f0ff' }} />
                  <span style={{ fontWeight: 600, letterSpacing: '0.8px', color: '#fff' }}>Sohbet & Bellek</span>
                </div>
                <button className="titlebar-btn" onClick={() => setShowChat(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div className="chat-messages">
                {/* Rich Empty State when conversation has not started */}
                {conversation.length === 0 && (
                  <div className="chat-empty-state">
                    <div className="holo-avatar-container">
                      <div className="holo-avatar-core">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="1.8">
                          <circle cx="12" cy="12" r="9"></circle>
                          <path d="M12 3v18"></path>
                          <path d="M3 12h18"></path>
                          <circle cx="12" cy="12" r="3" fill="#00f0ff" fillOpacity="0.3"></circle>
                        </svg>
                      </div>
                      <div className="holo-orbit-ring" />
                    </div>

                    <div className="chat-empty-title">JARVIS 2.0</div>
                    <div className="chat-empty-badge">SİSTEM ÇEVRİMİÇİ</div>
                    <p className="chat-empty-desc">
                      Sistem hazır ve dinlemede. Sesli komut verebilir veya aşağıdaki hızlı komutları kullanabilirsiniz.
                    </p>

                    {/* Quick Command Suggestion Chips */}
                    <div className="quick-command-grid">
                      <button className="quick-chip" onClick={() => sendTextMessage("Tarayıcıyı aç")}>
                        <span>🌐</span> Tarayıcıyı Aç
                      </button>
                      <button className="quick-chip" onClick={handleAnalyzeScreen}>
                        <span>👁️</span> Ekranı İncele
                      </button>
                      <button className="quick-chip" onClick={() => sendTextMessage("Spotify'ı aç ve müziği başlat")}>
                        <span>🎵</span> Müziği Başlat
                      </button>
                      <button className="quick-chip" onClick={() => sendTextMessage("Bugünkü hedeflerimi not al")}>
                        <span>📝</span> Not Ekle
                      </button>
                      <button className="quick-chip" onClick={() => sendTextMessage("10 dakika sonra bana su içmeyi hatırlat")}>
                        <span>⏱️</span> Hatırlatıcı Kur
                      </button>
                    </div>
                  </div>
                )}

                {conversation.map((msg, i) => (
                  <div key={i} className={`chat-bubble ${msg.role}`}>
                    {msg.content}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-container">
                <input 
                  type="text"
                  className="chat-input"
                  placeholder="Komut veya mesaj yazın..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                />
                <button className="chat-send-btn" onClick={handleSendText} title="Gönder">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Voice Notes Modal */}
      {showNotes && (
        <div className="modal-overlay" onClick={() => setShowNotes(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <h2 style={{ marginTop: 0, fontSize: '18px', fontWeight: 500, marginBottom: '16px' }}>📝 Sesli Not Defterim</h2>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input 
                type="text"
                className="input-field"
                placeholder="Yeni not ekle..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button className="save-btn" onClick={handleAddNote} style={{ width: '90px', marginTop: 0 }}>Ekle</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notes.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                  Henüz kaydedilmiş bir notunuz yok.
                </div>
              )}
              {notes.map(note => (
                <div key={note.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>{note.text}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{note.date}</div>
                  </div>
                  <button onClick={() => handleDeleteNote(note.id)} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', opacity: 0.7 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              ))}
            </div>

            <button className="save-btn" onClick={() => setShowNotes(false)} style={{ marginTop: '20px', background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
              Kapat
            </button>
          </motion.div>
        </div>
      )}

      {/* Camera Preview Modal */}
      {showCamera && (
        <div className="modal-overlay" onClick={handleToggleCamera}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ textAlign: 'center', maxWidth: '480px' }}
          >
            <h2 style={{ marginTop: 0, fontSize: '18px', fontWeight: 500, marginBottom: '16px' }}>JARVIS Gözü (Kamera)</h2>
            <div style={{ background: '#000', borderRadius: '16px', overflow: 'hidden', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button 
                className="save-btn" 
                onClick={handleCaptureAndAnalyze}
                style={{ flex: 1, background: '#007aff', color: 'white', marginTop: 0 }}
              >
                Görüntüyü Analiz Et
              </button>
              <button 
                className="save-btn" 
                onClick={handleToggleCamera}
                style={{ width: '100px', background: 'rgba(255,255,255,0.1)', color: 'white', marginTop: 0 }}
              >
                Kapat
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* QR Mobile Modal */}
      {showQR && qrData && (
        <div className="modal-overlay" onClick={() => setShowQR(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ textAlign: 'center' }}
          >
            <h2 style={{ marginTop: 0, fontSize: '20px', fontWeight: 500 }}>Telefondan Bağlan</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Telefonunuzla aynı Wi-Fi ağındayken QR kodu okutun.
            </p>
            
            <div style={{ background: 'white', padding: '16px', borderRadius: '16px', display: 'inline-block', marginBottom: '16px' }}>
              <QRCodeSVG value={qrData.url} size={200} />
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all', marginBottom: '20px' }}>
              {qrData.url}
            </div>

            <button className="save-btn" onClick={() => setShowQR(false)}>
              Kapat
            </button>
          </motion.div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal-content"
          >
            <h2 style={{ marginTop: 0, fontSize: '20px', fontWeight: 500 }}>{language === 'tr-TR' ? 'JARVIS Kurulumu' : 'JARVIS Setup'}</h2>
            
            <div style={{ marginTop: '24px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Google Gemini API Key</label>
              <input
                type="password"
                className="input-field"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
              />
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{language === 'tr-TR' ? 'Dil / Language' : 'Language / Dil'}</label>
              <select 
                className="input-field"
                value={language}
                onChange={(e) => setLanguage(e.target.value as JarvisLanguage)}
                style={{ appearance: 'none' }}
              >
                <option value="tr-TR">Türkçe</option>
                <option value="en-US">English</option>
              </select>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Ses Tonu (Pitch): {voicePitch.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="1.5" 
                step="0.05" 
                value={voicePitch} 
                onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#00f0ff', cursor: 'pointer', marginTop: '6px' }}
              />
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Ses Hızı (Speed): {voiceRate.toFixed(2)}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="1.5" 
                step="0.05" 
                value={voiceRate} 
                onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#00f0ff', cursor: 'pointer', marginTop: '6px' }}
              />
            </div>

            <button className="save-btn" onClick={handleSaveSettings}>
              {language === 'tr-TR' ? 'Kaydet & Bağlan' : 'Save & Connect'}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default App;
