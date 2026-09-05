/**
 * Native dialog utilities for NVL Studio.
 * Wraps Electron's dialog.showMessageBox with seamless web browser fallback.
 */

export interface DialogOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  detail?: string;
}

/**
 * Shows an informative or alert dialog to the user.
 */
export async function showMessageBox(
  title: string,
  message: string,
  type: 'info' | 'error' | 'warning' = 'info',
  detail?: string
): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).nvlDesktop?.showMessageBox) {
    await (window as any).nvlDesktop.showMessageBox({
      type,
      buttons: ['OK'],
      defaultId: 0,
      title,
      message,
      detail,
    });
  } else {
    alert(`${title}\n\n${message}${detail ? `\n\n${detail}` : ''}`);
  }
}

/**
 * Shows a confirmation dialog with Confirm and Cancel buttons.
 * Returns true if confirmed, false otherwise.
 */
export async function showConfirmDialog(
  title: string,
  message: string,
  detail?: string
): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).nvlDesktop?.showMessageBox) {
    const res = await (window as any).nvlDesktop.showMessageBox({
      type: 'question',
      buttons: ['Cancel', 'Confirm'],
      defaultId: 1,
      cancelId: 0,
      title,
      message,
      detail,
    });
    return res.response === 1;
  } else {
    return window.confirm(detail ? `${message}\n\n${detail}` : message);
  }
}
