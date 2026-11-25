import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  maxWidthClass = 'max-w-2xl',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[80] bg-[#000000]/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${maxWidthClass} max-h-[88vh] bg-[#0A0B0F] border border-[#1B1E26] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl`}
      >
        <div className="sm:hidden w-10 h-1.5 bg-[#1B1E26] rounded-full mx-auto mt-2.5 shrink-0" />
        <div className="px-4 py-3.5 border-b border-[#1B1E26] bg-[#101218] flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-base font-bold text-[#F1F5F9] truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[#0A0B0F] border border-[#1B1E26] text-[#8A92A2] hover:text-[#F1F5F9] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-4 overflow-y-auto flex flex-col gap-3.5">
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
