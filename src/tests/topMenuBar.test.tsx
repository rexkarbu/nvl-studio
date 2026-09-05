// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TopMenuBar } from '../modules/workspace/TopMenuBar';

describe('TopMenuBar Component & Memory Monitor', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders brand, project name, dirty state and server status correctly', () => {
    act(() => {
      root.render(
        <TopMenuBar
          projectName="My Test Avatar"
          isDirty={true}
          missingAssetsCount={2}
          serverPort={17777}
          onNewProject={() => {}}
          onOpenProject={() => {}}
          onSaveProject={() => {}}
          onSaveProjectAs={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('NVL');
    expect(container.textContent).toContain('PNGtuber Studio');
    expect(container.textContent).toContain('My Test Avatar');
    expect(container.textContent).toContain('2 Missing');
    expect(container.textContent).toContain('Local Server: 127.0.0.1:17777');
  });

  it('displays JavaScript heap memory monitor pill when performance.memory is available', () => {
    // Mock performance.memory (supported in Chromium/Electron)
    Object.defineProperty(window.performance, 'memory', {
      value: {
        usedJSHeapSize: 45 * 1024 * 1024, // 45 MB
        totalJSHeapSize: 64 * 1024 * 1024,
        jsHeapSizeLimit: 2048 * 1024 * 1024,
      },
      configurable: true,
    });

    act(() => {
      root.render(
        <TopMenuBar
          projectName="Memory Monitored Avatar"
          isDirty={false}
          missingAssetsCount={0}
          serverPort={17777}
          onNewProject={() => {}}
          onOpenProject={() => {}}
          onSaveProject={() => {}}
          onSaveProjectAs={() => {}}
        />
      );
    });

    const badge = container.querySelector('[data-testid="memory-monitor-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('45 MB');
  });
});
