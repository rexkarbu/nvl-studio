// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioMeter } from '../modules/workspace/AudioMeter';
import { ParameterStore } from '../core/parameters/ParameterStore';

describe('AudioMeter Component', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let store: ParameterStore;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    store = new ParameterStore();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders initial level and threshold marker position correctly', () => {
    store.update({ voiceLevel: 0.4, voiceActivity: true });

    act(() => {
      root.render(<AudioMeter store={store} threshold={0.25} />);
    });

    const percentageEl = container.querySelector('[data-testid="meter-percentage"]');
    const fillEl = container.querySelector('[data-testid="meter-fill"]') as HTMLElement;
    const thresholdEl = container.querySelector('[data-testid="meter-threshold"]') as HTMLElement;

    expect(percentageEl?.textContent).toContain('40%');
    expect(percentageEl?.textContent).toContain('(VOICE DETECTED)');
    expect(fillEl.style.width).toBe('40%');
    expect(fillEl.classList.contains('active')).toBe(true);
    expect(thresholdEl.style.left).toBe('25%');
  });

  it('reactively updates level fill and threshold marker when store updates', () => {
    act(() => {
      root.render(<AudioMeter store={store} threshold={0.3} />);
    });

    const fillEl = container.querySelector('[data-testid="meter-fill"]') as HTMLElement;
    const thresholdEl = container.querySelector('[data-testid="meter-threshold"]') as HTMLElement;
    const percentageEl = container.querySelector('[data-testid="meter-percentage"]');

    expect(percentageEl?.textContent).toContain('0%');
    expect(fillEl.style.width).toBe('0%');
    expect(thresholdEl.style.left).toBe('30%');

    // Update store to 65% voiceLevel
    act(() => {
      store.update({ voiceLevel: 0.65, voiceActivity: true });
    });

    expect(percentageEl?.textContent).toContain('65%');
    expect(fillEl.style.width).toBe('65%');
    expect(fillEl.classList.contains('active')).toBe(true);

    // Update store to silence (0% voiceLevel)
    act(() => {
      store.update({ voiceLevel: 0, voiceActivity: false });
    });

    expect(percentageEl?.textContent).toContain('0%');
    expect(fillEl.style.width).toBe('0%');
    expect(fillEl.classList.contains('active')).toBe(false);
  });

  it('renders 0% level when isListening is false even if store has audio', () => {
    store.update({ voiceLevel: 0.8, voiceActivity: true });

    act(() => {
      root.render(<AudioMeter store={store} threshold={0.2} isListening={false} />);
    });

    const percentageEl = container.querySelector('[data-testid="meter-percentage"]');
    const fillEl = container.querySelector('[data-testid="meter-fill"]') as HTMLElement;

    expect(percentageEl?.textContent).toContain('0%');
    expect(fillEl.style.width).toBe('0%');
    expect(fillEl.classList.contains('active')).toBe(false);
  });
});
