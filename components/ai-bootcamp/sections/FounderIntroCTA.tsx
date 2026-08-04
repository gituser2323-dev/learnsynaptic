"use client";

import { useState } from "react";
import Image from "next/image";
import { useRegisterModal } from "../RegisterModalContext";

export function FounderIntroCTA() {
  const { openRegister } = useRegisterModal();
  const [videoReady, setVideoReady] = useState(false);

  return (
    <>
      <section style={{ background: "var(--white)", padding: "0 6%" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <div style={{ color: "var(--blue-600)", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
            That&apos;s Why We Created
          </div>
          <h2
            style={{
              fontFamily: "var(--font-heading-editorial)",
              fontWeight: 800,
              fontSize: "clamp(24px, 4.5vw, 34px)",
              color: "var(--ink-black)",
              margin: "0 0 16px",
              letterSpacing: "-0.01em",
            }}
          >
            The 7-Day AI Engineering Bootcamp
          </h2>
          <p style={{ color: "var(--ink-600)", fontSize: 16, lineHeight: 1.7, maxWidth: 560, margin: "0 auto 40px" }}>
            Not just how to use AI—but how to choose the right tools, build practical applications, and solve
            real-world problems.
          </p>
          <div
            style={{
              position: "relative",
              borderRadius: "var(--radius-panel)",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(10,10,14,0.04),0 16px 48px rgba(10,10,14,0.12)",
              border: "1px solid var(--border-editorial)",
              aspectRatio: "16/9",
            }}
          >
            {/* A native `poster` attribute bypasses next/image entirely —
                browsers fetch it directly, unoptimized. This layers a
                next/image-optimized poster behind the video instead,
                cross-fading out once the video has data to paint. */}
            <Image
              src="/bootcamplogos/me.png"
              alt=""
              fill
              sizes="(max-width: 820px) 100vw, 820px"
              style={{ objectFit: "cover", opacity: videoReady ? 0 : 1, transition: "opacity 300ms ease" }}
              aria-hidden="true"
            />
            <video
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onCanPlay={() => setVideoReady(true)}
            >
              <source src="/videos/founder-intro.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div style={{ position: "absolute", bottom: 16, right: 16, pointerEvents: "none" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.95)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(10,10,14,0.25)",
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "9px solid transparent",
                    borderBottom: "9px solid transparent",
                    borderLeft: "15px solid var(--blue-600)",
                    marginLeft: 4,
                  }}
                />
              </div>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink-black)", marginTop: 20 }}>
            Pratik Sabale, Co Founder
          </div>
        </div>
      </section>

      <section style={{ background: "#fff", padding: "96px 6%" }}>
        <div style={{ background: "var(--paper)", borderRadius: "var(--radius-panel)", padding: "56px 48px", textAlign: "center" }}>
          <h3 style={{ fontFamily: "var(--font-heading-editorial)", fontWeight: 800, fontSize: "clamp(22px, 4vw, 30px)", color: "var(--ink-black)", margin: 0 }}>
            Stop Guessing. Start Building With The Right AI.
          </h3>
          <p style={{ color: "var(--ink-600)", fontSize: 16, maxWidth: 560, margin: "16px auto 0", lineHeight: 1.6 }}>
            Master the complete AI ecosystem through real-world projects, practical workflows, and hands-on
            implementation.
          </p>
          <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "center", marginTop: 28, flexWrap: "wrap" }}>
            <button
              onClick={openRegister}
              className="aib-btn"
              style={{ background: "var(--ls-primary)", color: "#fff", padding: "16px 32px", fontSize: 13.5 }}
            >
              Explore the AI Bootcamp →
            </button>
            <a href="#curriculum" style={{ color: "var(--ink-black)", fontSize: 14.5, fontWeight: 700, textDecoration: "underline" }}>
              See Complete AI Ecosystem
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
