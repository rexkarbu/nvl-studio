import { HotkeyMapping } from '../project/types';

export const DEFAULT_HOTKEY_MAPPINGS: ReadonlyArray<HotkeyMapping> = [
  { expressionId: 'neutral', key: 'F1' },
  { expressionId: 'happy', key: 'F2' },
  { expressionId: 'angry', key: 'F3' },
  { expressionId: 'sad', key: 'F4' },
];

export type HotkeyTriggerCallback = (expressionId: string) => void;

/**
 * Renderer-level hotkey manager.
 * Intercepts keyboard events within the application window and routes them to expression triggers.
 *
 * Rules:
 * - Uses renderer window.addEventListener('keydown') (ADR 001).
 * - Avoids globalShortcut to prevent conflicts with OBS or other software.
 * - Suppresses trigger if the user is typing in an input, textarea, or contentEditable element.
 */
export class HotkeyManager {
  private mappings: HotkeyMapping[];
  private onTrigger: HotkeyTriggerCallback;
  private isListening: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    onTrigger: HotkeyTriggerCallback,
    initialMappings?: HotkeyMapping[]
  ) {
    this.onTrigger = onTrigger;
    this.mappings = initialMappings && initialMappings.length > 0
      ? [...initialMappings]
      : [...DEFAULT_HOTKEY_MAPPINGS];
  }

  public setMappings(mappings: HotkeyMapping[]): void {
    this.mappings = [...mappings];
  }

  public getMappings(): ReadonlyArray<HotkeyMapping> {
    return this.mappings;
  }

  public start(): void {
    if (this.isListening || typeof window === 'undefined') return;

    this.keydownListener = (e: KeyboardEvent) => {
      this.handleKeyDown(e);
    };

    window.addEventListener('keydown', this.keydownListener);
    this.isListening = true;
  }

  public stop(): void {
    if (!this.isListening || typeof window === 'undefined') return;

    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    this.isListening = false;
  }

  /**
   * Processes a keydown event.
   * Returns true if a hotkey was matched and triggered, false otherwise.
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    // Ignore keystrokes when user is focused inside input elements
    const target = e.target as HTMLElement | null;
    if (target) {
      const tagName = target.tagName?.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable
      ) {
        return false;
      }
    }

    const eventKey = e.key.toUpperCase();
    const eventCtrl = e.ctrlKey;
    const eventShift = e.shiftKey;
    const eventAlt = e.altKey;

    for (const mapping of this.mappings) {
      const targetKey = mapping.key.toUpperCase();
      const requireCtrl = Boolean(mapping.ctrl);
      const requireShift = Boolean(mapping.shift);
      const requireAlt = Boolean(mapping.alt);

      if (
        eventKey === targetKey &&
        eventCtrl === requireCtrl &&
        eventShift === requireShift &&
        eventAlt === requireAlt
      ) {
        e.preventDefault();
        this.onTrigger(mapping.expressionId);
        return true;
      }
    }

    return false;
  }
}
