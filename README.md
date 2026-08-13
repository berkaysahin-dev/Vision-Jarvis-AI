# 🤖 JARVIS 2.0 — AI Desktop Voice & Vision Assistant

> **Powered by [Shaz Vision](https://shazvision.com)**

JARVIS 2.0 is an advanced native Windows desktop AI assistant built with **Electron**, **React**, **Three.js**, and **Google Gemini API**. It features real-time voice interaction with automated Voice Activity Detection (VAD), system application control, live webcam vision analysis, and a remote mobile control web application.

---

## ✨ Features

- 🎤 **Real-time Voice Assistant (VAD)**: Hands-free voice recognition with automatic silence detection for instant responses.
- ⚡ **System & Computer Control**: Launch Chrome/Browser, Spotify, VS Code, Notepad, Calculator, and local applications via voice or chat.
- 👁️ **Camera & Vision Analysis**: Real-time webcam frame capture and multimodal visual scene analysis using Google Gemini.
- 📱 **Mobile Remote Control**: Scan QR code to control JARVIS from your smartphone over local Wi-Fi network.
- 🍎 **Apple macOS Glassmorphism UI**: Sleek, dark translucent glass interface designed following Apple Human Interface Guidelines with pure vector SVG icons.
- 🔒 **Persistent Local Memory**: Secure local JSON storage for facts, user preferences, and persistent memory.

---

## 💻 Tech Stack

- **Framework**: Electron + React (TypeScript) + Vite
- **3D Graphics**: Three.js + React Three Fiber (Interactive AI Orb)
- **AI Engine**: Google Gemini API (`gemini-3.6-flash` REST & `gemini-2.5-flash-native-audio-latest` Live WebSocket)
- **Backend & Network**: Node.js `child_process` + Express (Mobile Remote Server)

---

## 🚀 Quick Start & Installation

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Google Gemini API Key**: Get a free API key from [Google AI Studio](https://aistudio.google.com/)

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/berkaysahin-dev/Vision-Jarvis-AI.git
   cd Vision-Jarvis-AI
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Run Production Desktop App**
   Double-click `BASLAT.bat` on Windows or run:
   ```bash
   npm run build
   npx electron .
   ```

---

## ⚙️ Configuration

1. Launch JARVIS 2.0.
2. Enter your **Google Gemini API Key** in the Settings panel.
3. Save settings to persist the configuration locally on your machine.

---

## 🌐 Brand & Support

Developed with ❤️ by **[Shaz Vision](https://shazvision.com)**.

- Website: [https://shazvision.com](https://shazvision.com)
- Repository: [github.com/berkaysahin-dev/Vision-Jarvis-AI](https://github.com/berkaysahin-dev/Vision-Jarvis-AI)

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
