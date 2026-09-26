import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  id: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}

/** Keep native modal focus trapping and Escape behavior; React owns its contents. */
export function Dialog({ id, titleId, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      // React removes the dialog on close, so explicitly restore the opener's focus.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      {children}
    </dialog>
  );
}

export function CloseButton({ onClose, label = 'Close' }: { onClose: () => void; label?: string }) {
  return (
    <button type="button" className="close-button" data-close aria-label={label} onClick={onClose}>
      ×
    </button>
  );
}
