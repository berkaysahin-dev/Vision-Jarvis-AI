import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import os from 'os'

function getLocalIp() {
  const interfaces = os.networkInterfaces()
  for (const devName in interfaces) {
    const iface = interfaces[devName]
    if (!iface) continue
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i]
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address
      }
    }
  }
  return 'localhost'
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), mkcert()],
  define: {
    'import.meta.env.VITE_LOCAL_IP': JSON.stringify(getLocalIp())
  },
  server: {
    host: true, // Listen on all local IPs
    https: true, // Force HTTPS for Microphone support
  }
})
