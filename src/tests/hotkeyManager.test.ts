// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HotkeyManager } from '../core/input/HotkeyManager';

describe('STEP 12: HotkeyManager', () => {
  let triggerSpy: (expressionId: string) => void;
  let manager: HotkeyManager;

  beforeEach(() => {
    triggerSpy = vi.fn();
    manager = new HotkeyManager(triggerSpy);
    manager.start();
  });

  afterEach(() => {
    manager.stop();
    vi.restoreAllMocks();
  });

  it('triggersExpressionOnF1F2F3: default hotkeys fire appropriate expression triggers', () => {
    // Press F1 -> neutral
    const eventF1 = new KeyboardEvent('keydown', { key: 'F1', cancelable: true });
    window.dispatchEvent(eventF1);
    expect(triggerSpy).toHaveBeenCalledWith('neutral');

    // Press F2 -> happy
    const eventF2 = new KeyboardEvent('keydown', { key: 'F2', cancelable: true });
    window.dispatchEvent(eventF2);
    expect(triggerSpy).toHaveBeenCalledWith('happy');

    // Press F3 -> angry
    const eventF3 = new KeyboardEvent('keydown', { key: 'F3', cancelable: true });
    window.dispatchEvent(eventF3);
    expect(triggerSpy).toHaveBeenCalledWith('angry');

    // Press F4 -> sad
    const eventF4 = new KeyboardEvent('keydown', { key: 'F4', cancelable: true });
    window.dispatchEvent(eventF4);
    expect(triggerSpy).toHaveBeenCalledWith('sad');
  });

  it('respectsCtrlShiftAltModifiers: modifier combinations are required when specified', () => {
    manager.setMappings([
      { expressionId: 'shock', key: '1', ctrl: true },
      { expressionId: 'embarrassed', key: '2', shift: true, alt: true },
    ]);

    // Press '1' without Ctrl -> should NOT trigger
    const eventNoCtrl = new KeyboardEvent('keydown', { key: '1', ctrlKey: false, cancelable: true });
    window.dispatchEvent(eventNoCtrl);
    expect(triggerSpy).not.toHaveBeenCalled();

    // Press '1' with Ctrl -> should trigger 'shock'
    const eventWithCtrl = new KeyboardEvent('keydown', { key: '1', ctrlKey: true, cancelable: true });
    window.dispatchEvent(eventWithCtrl);
    expect(triggerSpy).toHaveBeenCalledWith('shock');

    // Press '2' with only shift -> should NOT trigger
    const eventOnlyShift = new KeyboardEvent('keydown', { key: '2', shiftKey: true, altKey: false, cancelable: true });
    window.dispatchEvent(eventOnlyShift);
    expect(triggerSpy).toHaveBeenCalledTimes(1);

    // Press '2' with Shift + Alt -> should trigger 'embarrassed'
    const eventShiftAlt = new KeyboardEvent('keydown', { key: '2', shiftKey: true, altKey: true, cancelable: true });
    window.dispatchEvent(eventShiftAlt);
    expect(triggerSpy).toHaveBeenCalledWith('embarrassed');
  });

  it('ignoresInputWhenTypingInFormFields: does not trigger when target is an input or textarea', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const eventInInput = new KeyboardEvent('keydown', {
      key: 'F2',
      cancelable: true,
      bubbles: true,
    });
    Object.defineProperty(eventInInput, 'target', { value: input });

    const handled = manager.handleKeyDown(eventInInput);
    expect(handled).toBe(false);
    expect(triggerSpy).not.toHaveBeenCalled();

    input.remove();
  });
});
