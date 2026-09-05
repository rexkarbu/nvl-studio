import { vi } from 'vitest';

/** Simulate the Canvas drawing boundary; execute the real renderer and record its output. */
export function createCanvasHarness() {
  const draws: { image: CanvasImageSource; filter: string }[] = [];
  const saved: { filter: string; globalAlpha: number }[] = [];
  const context = {
    filter: 'none', globalAlpha: 1,
    clearRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(), setLineDash: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), rect: vi.fn(),
    save: vi.fn(() => saved.push({ filter: context.filter, globalAlpha: context.globalAlpha })),
    restore: vi.fn(() => Object.assign(context, saved.pop())),
    drawImage: vi.fn((image: CanvasImageSource) => draws.push({ image, filter: context.filter })),
  };
  return { context: context as unknown as CanvasRenderingContext2D, draws };
}
