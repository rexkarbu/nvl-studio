// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { LiveOutputApp } from '../modules/live/LiveOutputApp';
import { createCanvasHarness } from './helpers/canvasHarness';
import { createReactiveManifest, FRAME_DATA_URL } from './helpers/reactiveAvatar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class TestSocket {
  static instances: TestSocket[] = [];
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn(() => { this.readyState = 3; });
  constructor(public url: string) {
    TestSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }
}

class TestImage {
  complete = true;
  naturalWidth = 10;
  naturalHeight = 10;
  onload: (() => void) | null = null;
  private source = '';
  set src(value: string) {
    this.source = value;
    queueMicrotask(() => this.onload?.());
  }
  get src() { return this.source; }
}

describe('Live Output route -> manifest -> WebSocket -> renderer', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let canvas: ReturnType<typeof createCanvasHarness>;
  const response = (id: string) => ({ ok: true, json: async () => createReactiveManifest(id) });

  beforeEach(() => {
    window.history.replaceState({}, '', '/live/custom-project');
    canvas = createCanvasHarness();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvas.context);
    vi.stubGlobal('Image', TestImage);
    vi.stubGlobal('WebSocket', TestSocket);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('fetch', vi.fn(async () => response('custom-project')));
    TestSocket.instances = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the requested project through App and renders frames received in that room', async () => {
    await act(async () => root.render(<App />));
    expect(TestSocket.instances.map((socket) => socket.url)).toEqual(['ws://localhost:3000/ws/custom-project']);
    const socket = TestSocket.instances[0];
    const send = (talking: boolean, sequence: number) => act(() => socket.onmessage?.({ data: JSON.stringify({
      version: 1, type: 'parameters', projectId: 'custom-project', timestamp: 1000, sequence,
      parameters: { voiceActivity: talking, voiceLevel: 0, mouthShape: 'closed', mouthOpen: 0, blink: false },
    }) }));
    send(true, 1);
    const talkingDraw = canvas.draws.at(-1)!;
    expect((talkingDraw.image as HTMLImageElement).src).toMatch(/^\/assets\/user-talk.png\?v=/);
    expect(talkingDraw.filter).toBe('none');
    send(false, 2);
    expect((canvas.draws.at(-1)!.image as HTMLImageElement).src).toBe(FRAME_DATA_URL);
    expect(canvas.draws.at(-1)!.filter).toBe('brightness(40%)');
  });

  it('waits for the loaded project on a route with no ID, with no default-room connection', async () => {
    window.history.replaceState({}, '', '/#/live');
    let finish!: (value: ReturnType<typeof response>) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    await act(async () => root.render(<App />));
    expect(TestSocket.instances).toHaveLength(0);
    await act(async () => finish(response('loaded-project')));
    expect(TestSocket.instances.map((socket) => socket.url)).toEqual(['ws://localhost:3000/ws/loaded-project']);
  });

  it('closes the old room and resets sequence/frames when the route changes projects', async () => {
    await act(async () => root.render(<LiveOutputApp />));
    const first = TestSocket.instances[0];
    vi.stubGlobal('fetch', vi.fn(async () => response('second-project')));
    await act(async () => {
      window.history.pushState({}, '', '/#/live/second-project');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(first.close).toHaveBeenCalledOnce();
    expect(TestSocket.instances.map((socket) => socket.url)).toEqual([
      'ws://localhost:3000/ws/custom-project', 'ws://localhost:3000/ws/second-project',
    ]);
  });

  it('does not combine one project manifest with another project room', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response('different-project')));
    await act(async () => root.render(<LiveOutputApp />));
    expect(TestSocket.instances).toHaveLength(0);
    expect(canvas.draws).toHaveLength(0);
  });

  it('uses the in-memory project for embedded preview without fetching stale disk data', async () => {
    const manifest = createReactiveManifest();
    await act(async () => root.render(<LiveOutputApp initialManifest={manifest} />));
    expect(fetch).not.toHaveBeenCalled();
    expect(TestSocket.instances[0].url).toContain('/ws/custom-project');
    await act(async () => root.render(<LiveOutputApp initialManifest={{ ...manifest, audioConfig: { ...manifest.audioConfig, releaseDelayMs: 1000 } }} />));
    expect(TestSocket.instances).toHaveLength(1);
  });
});
