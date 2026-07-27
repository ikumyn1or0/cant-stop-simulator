import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function shutdownPlugin() {
  return {
    name: 'shutdown',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/__shutdown', (_req: unknown, res: import('http').ServerResponse) => {
        res.end('ok');
        server.close().then(() => process.exit(0));
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/cant-stop-simulator/',
  plugins: [
    react(),
    shutdownPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'キャントストップ バースト確率',
        short_name: 'バースト確率',
        description: 'キャントストップのバースト確率を1296通り全列挙で厳密計算するツール',
        theme_color: '#b45309',
        background_color: '#faf5ef',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: { open: true },
}));
