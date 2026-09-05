// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { showMessageBox, showConfirmDialog } from '../modules/workspace/dialogUtils';

describe('dialogUtils (Native Dialog Bridge)', () => {
  const originalDesktop = (window as any).nvlDesktop;
  const originalAlert = window.alert;
  const originalConfirm = window.confirm;

  afterEach(() => {
    (window as any).nvlDesktop = originalDesktop;
    window.alert = originalAlert;
    window.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  describe('showMessageBox', () => {
    it('should invoke window.nvlDesktop.showMessageBox in Electron environment', async () => {
      const mockShow = vi.fn().mockResolvedValue({ response: 0 });
      (window as any).nvlDesktop = { showMessageBox: mockShow };

      await showMessageBox('Info Title', 'Operation completed', 'info', 'Extra details here');

      expect(mockShow).toHaveBeenCalledWith({
        type: 'info',
        buttons: ['OK'],
        defaultId: 0,
        title: 'Info Title',
        message: 'Operation completed',
        detail: 'Extra details here',
      });
    });

    it('should fallback to window.alert when not running in Electron', async () => {
      (window as any).nvlDesktop = undefined;
      const alertSpy = vi.fn();
      window.alert = alertSpy;

      await showMessageBox('Warning', 'Something happened', 'warning', 'More info');

      expect(alertSpy).toHaveBeenCalledWith('Warning\n\nSomething happened\n\nMore info');
    });
  });

  describe('showConfirmDialog', () => {
    it('should invoke nvlDesktop.showMessageBox and return true when user confirms (response 1)', async () => {
      const mockShow = vi.fn().mockResolvedValue({ response: 1 });
      (window as any).nvlDesktop = { showMessageBox: mockShow };

      const result = await showConfirmDialog('Confirm Action', 'Are you sure?', 'Detail text');

      expect(mockShow).toHaveBeenCalledWith({
        type: 'question',
        buttons: ['Cancel', 'Confirm'],
        defaultId: 1,
        cancelId: 0,
        title: 'Confirm Action',
        message: 'Are you sure?',
        detail: 'Detail text',
      });
      expect(result).toBe(true);
    });

    it('should invoke nvlDesktop.showMessageBox and return false when user cancels (response 0)', async () => {
      const mockShow = vi.fn().mockResolvedValue({ response: 0 });
      (window as any).nvlDesktop = { showMessageBox: mockShow };

      const result = await showConfirmDialog('Confirm Action', 'Are you sure?');

      expect(result).toBe(false);
    });

    it('should fallback to window.confirm when not in Electron', async () => {
      (window as any).nvlDesktop = undefined;
      const confirmSpy = vi.fn().mockReturnValue(true);
      window.confirm = confirmSpy;

      const result = await showConfirmDialog('Confirm', 'Are you sure?');

      expect(confirmSpy).toHaveBeenCalledWith('Are you sure?');
      expect(result).toBe(true);
    });
  });
});
