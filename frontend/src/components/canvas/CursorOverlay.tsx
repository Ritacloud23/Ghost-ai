"use client";

import { Cursor } from "@/lib/types";

interface CursorOverlayProps {
  cursors: Record<string, Cursor>;
  currentUserId: string;
}

export default function CursorOverlay({ cursors, currentUserId }: CursorOverlayProps) {
  return (
    <>
      {Object.entries(cursors).map(([userId, cursor]) => {
        if (userId === currentUserId) return null;

        return (
          <div
            key={userId}
            className="pointer-events-none absolute z-50 transition-all duration-75"
            style={{ left: cursor.x, top: cursor.y }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 2L18 10L10 12L8 18L2 2Z" fill={cursor.color} stroke="white" strokeWidth="1" />
            </svg>
            <span
              className="ml-4 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: cursor.color }}
            >
              {userId.slice(0, 6)}
            </span>
          </div>
        );
      })}
    </>
  );
}
