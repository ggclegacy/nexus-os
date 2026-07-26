"use client";

import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <span
          className="skeleton-line"
          key={index}
          style={{ width: `${100 - index * 13}%` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="state state--empty">
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "This section is unavailable",
  detail,
  onRetry,
}: {
  title?: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state state--error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      {onRetry ? (
        <Button
          variant="tertiary"
          onClick={onRetry}
          icon={<RefreshCw aria-hidden="true" />}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function ConnectionNotice({
  offline,
  stale,
}: {
  offline: boolean;
  stale: boolean;
}) {
  if (!offline && !stale) return null;
  return (
    <div className="connection-notice" role="status">
      <CloudOff aria-hidden="true" />
      <span>
        {offline
          ? "Offline. Showing the last loaded local view; changes require a connection."
          : "This view may be stale. Refresh when you are ready."}
      </span>
    </div>
  );
}
