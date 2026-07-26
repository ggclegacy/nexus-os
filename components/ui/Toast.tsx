"use client";

import { X } from "lucide-react";
import { Button } from "./Button";

export interface ToastMessage {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

export function ToastRegion({
  toast,
  onDismiss,
}: {
  toast: ToastMessage | null;
  onDismiss(): void;
}) {
  if (!toast) return <div className="toast-region" aria-live="polite" />;
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      <div className="toast">
        <span>{toast.message}</span>
        {toast.actionLabel && toast.onAction ? (
          <Button
            variant="tertiary"
            onClick={async () => {
              await toast.onAction?.();
              onDismiss();
            }}
          >
            {toast.actionLabel}
          </Button>
        ) : null}
        <Button
          variant="icon"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          icon={<X aria-hidden="true" />}
        />
      </div>
    </div>
  );
}
