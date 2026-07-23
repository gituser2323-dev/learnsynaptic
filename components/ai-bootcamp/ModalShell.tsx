"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function ModalShell({
  open,
  onClose,
  children,
  maxWidth = 460,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="aib-root" style={{ fontFamily: "var(--font-body)" }}>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 201,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflowY: "auto",
          padding: "24px 16px",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "100%",
            maxWidth,
            margin: "auto",
            borderRadius: "var(--radius-panel)",
            background: "var(--ls-dark)",
            color: "#fff",
            border: "1px solid var(--border-promo)",
            boxShadow: "var(--shadow-glow)",
            padding: "40px 32px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -100,
              left: -80,
              width: 280,
              height: 280,
              background: "radial-gradient(circle, rgba(22,93,252,0.22), transparent 70%)",
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          />
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 5,
              width: 44,
              height: 44,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 999,
              padding: 0,
              cursor: "pointer",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
          <div style={{ position: "relative" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
