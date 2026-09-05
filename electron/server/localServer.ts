import http from 'http';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import { WebSocketBroadcastManager } from './wsBroadcast';

export interface LocalServerOptions {
  preferredPort: number;
  staticDir?: string;
  maxPortRetries?: number;
}

export interface ServerInfo {
  host: string;
  port: number;
  liveUrlTemplate: string;
  wsUrlTemplate: string;
}

/**
 * Checks if a specific port on 127.0.0.1 is available.
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tester
          .once('close', () => {
            resolve(true);
          })
          .close();
      })
      .listen(port, '127.0.0.1');
  });
}

/**
 * Resolves an available port starting from preferredPort.
 */
export async function resolveAvailablePort(
  preferredPort: number,
  maxRetries: number = 30
): Promise<number> {
  for (let i = 0; i < maxRetries; i++) {
    const candidate = preferredPort + i;
    const available = await isPortAvailable(candidate);
    if (available) {
      return candidate;
    }
  }
  throw new Error(
    `[LocalServer] Could not find an available port in range ${preferredPort} - ${preferredPort + maxRetries}`
  );
}

export class LocalServer {
  private preferredPort: number;
  private maxPortRetries: number;
  private staticDir: string;
  private resolvedPort: number | null = null;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private wsManager: WebSocketBroadcastManager = new WebSocketBroadcastManager();
  private isRunning: boolean = false;
  private openSockets: Set<net.Socket> = new Set();
  private projectDir: string | null = null;

  constructor(options: LocalServerOptions) {
    this.preferredPort = options.preferredPort;
    this.maxPortRetries = options.maxPortRetries ?? 30;
    this.staticDir = options.staticDir || path.resolve(process.cwd(), 'dist');
  }

  public setProjectDir(dir: string | null): void {
    this.projectDir = dir;
  }

  public async start(): Promise<ServerInfo> {
    if (this.isRunning && this.resolvedPort !== null) {
      return this.getServerInfo();
    }

    const port = await resolveAvailablePort(this.preferredPort, this.maxPortRetries);
    this.resolvedPort = port;

    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      // Track active sockets for immediate clean shutdown
      this.httpServer.on('connection', (socket) => {
        this.openSockets.add(socket);
        socket.on('close', () => {
          this.openSockets.delete(socket);
        });
      });

      this.wss = new WebSocketServer({ noServer: true });
      this.wsManager.attach(this.wss);

      // Handle HTTP upgrade to WebSocket
      this.httpServer.on('upgrade', (req, socket, head) => {
        const url = req.url || '';
        if (url.startsWith('/ws/')) {
          this.wss?.handleUpgrade(req, socket, head, (ws) => {
            this.wss?.emit('connection', ws, req);
          });
        } else {
          socket.destroy();
        }
      });

      this.httpServer.once('error', (err) => {
        this.isRunning = false;
        reject(err);
      });

      // Explicitly bind to 127.0.0.1 (not 0.0.0.0)
      this.httpServer.listen(port, '127.0.0.1', () => {
        this.isRunning = true;
        resolve(this.getServerInfo());
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    this.wsManager.closeAll();

    // Destroy all lingering HTTP sockets
    for (const socket of this.openSockets) {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
    }
    this.openSockets.clear();

    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.httpServer = null;
          this.resolvedPort = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getServerInfo(): ServerInfo {
    if (!this.resolvedPort) {
      throw new Error('[LocalServer] Server is not running');
    }
    return {
      host: '127.0.0.1',
      port: this.resolvedPort,
      liveUrlTemplate: `http://127.0.0.1:${this.resolvedPort}/live/:projectId`,
      wsUrlTemplate: `ws://127.0.0.1:${this.resolvedPort}/ws/:projectId`,
    };
  }

  public getResolvedPort(): number | null {
    return this.resolvedPort;
  }

  public getWsManager(): WebSocketBroadcastManager {
    return this.wsManager;
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Add CORS & no-cache headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const rawUrl = req.url || '/';
    const cleanUrl = rawUrl.split('?')[0].split('#')[0];

    if (cleanUrl === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          resolvedPort: this.resolvedPort,
          uptime: process.uptime(),
        })
      );
      return;
    }

    // Serve current project manifest (used by OBS Browser Source / LiveOutputApp)
    if (cleanUrl === '/api/project' || cleanUrl === '/project.nvl' || cleanUrl.startsWith('/api/project/')) {
      let projectFile: string | null = null;
      if (this.projectDir) {
        const candidate = path.join(this.projectDir, 'project.nvl');
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          projectFile = candidate;
        }
      }
      if (!projectFile) {
        const sampleCandidate = path.resolve(process.cwd(), 'sample_avatar/project.nvl');
        if (fs.existsSync(sampleCandidate) && fs.statSync(sampleCandidate).isFile()) {
          projectFile = sampleCandidate;
        }
      }
      if (projectFile && fs.existsSync(projectFile)) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        });
        fs.createReadStream(projectFile).pipe(res);
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project manifest not found' }));
        return;
      }
    }

    // Determine if this is a static asset request (has file extension or contains /assets/ or /sample_avatar/)
    const hasExtension = path.extname(cleanUrl) !== '';
    const isAssetPath = cleanUrl.includes('/assets/') || cleanUrl.includes('/sample_avatar/');

    if (hasExtension || isAssetPath) {
      // If browser requested relative to /live/ (e.g. /live/assets/index.js), normalize by stripping /live/
      let normalized = cleanUrl.replace(/^\/live\//, '/');

      // 1. If project directory is set and request is for project assets, check project directory
      if (this.projectDir && (normalized.startsWith('/assets/') || normalized.startsWith('assets/'))) {
        const relativeAsset = normalized.replace(/^\/+/, '');
        const projectAssetPath = path.normalize(path.join(this.projectDir, relativeAsset));
        if (projectAssetPath.startsWith(path.normalize(this.projectDir)) && fs.existsSync(projectAssetPath) && fs.statSync(projectAssetPath).isFile()) {
          this.serveStaticFile(projectAssetPath, res);
          return;
        }
      }

      // 2. Check static directory
      if (normalized.startsWith('/sample_avatar/assets/')) {
        // Direct match
      } else if (normalized.startsWith('/assets/') && !fs.existsSync(path.join(this.staticDir, normalized))) {
        // If /assets/body.png doesn't exist directly, check /sample_avatar/assets/body.png
        const altPath = path.join(this.staticDir, 'sample_avatar', normalized);
        if (fs.existsSync(altPath) && fs.statSync(altPath).isFile()) {
          normalized = `/sample_avatar${normalized}`;
        } else {
          // In development mode, check process.cwd()/sample_avatar/assets
          const devSample = path.resolve(process.cwd(), 'sample_avatar', normalized.replace(/^\//, ''));
          if (fs.existsSync(devSample) && fs.statSync(devSample).isFile()) {
            this.serveStaticFile(devSample, res);
            return;
          }
        }
      }

      const safePath = path.normalize(path.join(this.staticDir, normalized)).replace(/^(\.\.[\/\\])+/, '');
      if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
        this.serveStaticFile(safePath, res);
        return;
      }
    }

    // Handle SPA HTML route: / or /live/:projectId
    if (cleanUrl === '/' || cleanUrl.startsWith('/live')) {
      const indexPath = path.join(this.staticDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        // Fallback transparent minimal HTML if dist/index.html is not yet built
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.generateFallbackLiveHtml());
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  private serveStaticFile(filePath: string, res: http.ServerResponse): void {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.woff2': 'font/woff2',
      '.woff': 'font/woff',
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  }

  private generateFallbackLiveHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NVL Live Output</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: transparent !important;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
  }
}
