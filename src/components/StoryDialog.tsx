import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';
export default function StoryDialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (!open) { if (dialog.open) dialog.close(); return; }
    const opener = document.activeElement as HTMLElement;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, [open]);
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={onClose} onClose={onClose} onClick={e => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose();
  }}><button className="close" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button><div>{children}</div></dialog>;
}
