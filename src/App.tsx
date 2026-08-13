import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useJarvis } from './hooks/useJarvis';
import { Orb } from './components/Orb';

export type JarvisLanguage = 'tr-TR' | 'en-US';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [qrData, setQrData] = useState<{ ip: string; port: number; token: string; url: string } | null>(null);
  const [language, setLanguage] = useState<JarvisLanguage>('tr-TR');

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
    startListening,
    stopListening,
    sendTextMessage,
    sendImageToGemini
  } = useJarvis(apiKey, language);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, currentResponse]);

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
        ipcRenderer.on('mobile-command', handleMobileCmd);
        return () => {
          ipcRenderer.removeListener('mobile-command', handleMobileCmd);
        };
      } catch (e) {
        console.error('IPC Listener Error:', e);
      }
    }
  }, [sendTextMessage]);

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

  const handleOrbClick = () => {
    if (status === 'listening') {
      stopListening();
    } else if (status === 'idle' || status === 'error') {
      startListening();
    }
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      sendTextMessage(textInput);
      setTextInput('');
    }
  };

  const getStatusText = () => {
    if (status === 'listening') return language === 'tr-TR' ? 'Dinliyorum...' : 'Listening...';
    if (status === 'processing') return language === 'tr-TR' ? 'Düşünüyorum...' : 'Thinking...';
    if (status === 'speaking') return language === 'tr-TR' ? 'Konuşuyorum...' : 'Speaking...';
    if (status === 'error') return language === 'tr-TR' ? 'Hata' : 'Error';
    return language === 'tr-TR' ? 'Konuşmak için dokun' : 'Tap to speak';
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Custom Titlebar */}
      <div className="titlebar">
        <div className="titlebar-title">JARVIS</div>
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
        {/* Toggle Right Chat Panel */}
        <button 
          onClick={() => setShowChat(!showChat)}
          title="Sohbet Paneli"
          style={{ background: 'none', border: 'none', color: showChat ? 'white' : 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        {/* Camera Toggle Button */}
        <button 
          onClick={handleToggleCamera}
          title="Kamerayı Aç"
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.color = 'white'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </button>

        {/* Mobile QR Button */}
        <button 
          onClick={handleOpenQR}
          title="Telefondan Bağlan"
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.color = 'white'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
        </button>

        {/* Settings Button */}
        <button 
          onClick={() => setShowSettings(true)}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.color = 'white'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        {/* Left Sidebar */}
        <aside className="left-sidebar">
          {/* Shaz Vision Brand Banner */}
          <div className="sidebar-brand" onClick={() => openExternalLink('https://shazvision.com')}>
            <div className="brand-badge">⚡ SHAZ VISION</div>
            <div className="brand-link">shazvision.com ↗</div>
          </div>

          <div className="sidebar-section-title">HIZLI AKSİYONLAR</div>
          <div className="sidebar-actions">
            <button className="sidebar-btn" onClick={() => sendTextMessage("Tarayıcıyı aç")}>
              <span className="btn-icon">🌐</span> Tarayıcıyı Aç
            </button>
            <button className="sidebar-btn" onClick={() => sendTextMessage("Spotify'ı aç")}>
              <span className="btn-icon">🎵</span> Spotify
            </button>
            <button className="sidebar-btn" onClick={() => sendTextMessage("VS Code aç")}>
              <span className="btn-icon">💻</span> VS Code
            </button>
            <button className="sidebar-btn" onClick={() => sendTextMessage("Not defterini aç")}>
              <span className="btn-icon">📝</span> Not Defteri
            </button>
            <button className="sidebar-btn" onClick={() => sendTextMessage("Hesap makinesi aç")}>
              <span className="btn-icon">🧮</span> Hesap Makinesi
            </button>
          </div>

          <div className="sidebar-section-title" style={{ marginTop: '20px' }}>CANLI ARAÇLAR</div>
          <div className="sidebar-actions">
            <button className="sidebar-btn" onClick={handleToggleCamera}>
              <span className="btn-icon">📷</span> Kamera Görsel Analiz
            </button>
            <button className="sidebar-btn" onClick={handleOpenQR}>
              <span className="btn-icon">📱</span> Telefondan QR Bağlantı
            </button>
            <button className="sidebar-btn" onClick={() => setShowSettings(true)}>
              <span className="btn-icon">⚙️</span> Sistem Ayarları
            </button>
          </div>

          {/* Shaz Vision Signature Footer */}
          <div className="sidebar-footer" onClick={() => openExternalLink('https://shazvision.com')}>
            <div style={{ fontSize: '10px', opacity: 0.5, letterSpacing: '1px' }}>POWERED BY</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#00f0ff', letterSpacing: '1px', marginTop: '2px' }}>SHAZ VISION</div>
            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>shazvision.com</div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content" style={{ flex: 1, paddingBottom: 0 }}>
          <div className="ai-presence" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.div 
              className="orb-container"
              onClick={handleOrbClick}
              animate={{ scale: status === 'listening' ? 1.05 : 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <Orb status={status} audioLevel={audioLevel} />
              </Canvas>
            </motion.div>

            <motion.div 
              className={`status-text ${status}`}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: status === 'idle' ? 3 : 1 }}
              style={{ marginTop: '16px' }}
            >
              {getStatusText()}
            </motion.div>

            {/* Welcome Message directly below status-text inside flex container */}
            {status === 'idle' && conversation.length === 0 && !currentResponse && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: '24px', textAlign: 'center', pointerEvents: 'none' }}
              >
                <p className="jarvis-response" style={{ opacity: 0.7, fontSize: '18px', margin: 0, lineHeight: 1.4 }}>
                  {language === 'tr-TR' ? (
                    <>
                      {new Date().getHours() < 12 ? 'Günaydın.' : new Date().getHours() < 18 ? 'İyi günler.' : 'İyi akşamlar.'}
                      <br/>Nasıl yardımcı olabilirim?
                    </>
                  ) : (
                    <>
                      {new Date().getHours() < 12 ? 'Good morning.' : new Date().getHours() < 18 ? 'Good afternoon.' : 'Good evening.'}
                      <br/>How can I help you?
                    </>
                  )}
                </p>
              </motion.div>
            )}
          </div>

          {/* Current Live AI Response Display */}
          {currentResponse && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: '32px', textAlign: 'center', maxWidth: '600px', width: '90%' }}
            >
              <p className="jarvis-response" style={{ fontSize: '20px' }}>{currentResponse}</p>
            </motion.div>
          )}
        </main>

        {/* Right Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="chat-sidebar"
            >
              <div className="chat-header">
                <span>JARVIS SOHBET</span>
                <button 
                  onClick={() => setShowChat(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div className="chat-messages">
                {conversation.length === 0 && (
                  <div style={{ textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px', letterSpacing: '1px' }}>
                    Sohbet henüz başlamadı
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
                  placeholder="Mesaj yazın..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                />
                <button className="chat-send-btn" onClick={handleSendText}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

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

            <button className="save-btn" onClick={handleSaveSettings}>
              {language === 'tr-TR' ? 'Kaydet & Bağlan' : 'Save & Connect'}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
