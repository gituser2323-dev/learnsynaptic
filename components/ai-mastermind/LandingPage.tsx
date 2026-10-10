"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import "../ai-bootcamp/ai-bootcamp.css"; // popup styles (scoped under .aib-root)
import "./ai-mastermind.css";
import { RegisterModalProvider, useRegisterModal } from "../ai-bootcamp/RegisterModalContext";
import { AI_MASTERMIND, getNextSessionLabel } from "@/config/aiMastermind";
import Image from "next/image";
import { sessions, audiences, tools, faqs, reviews, sampleReviews, galleryPhotos, pricePoints, certificateSrc, certificatePdf, certificateAlt } from "./data";

const RegistrationModal = dynamic(() => import("../ai-bootcamp/RegistrationModal").then((m) => m.RegistrationModal));
const SuccessModal = dynamic(() => import("../ai-bootcamp/SuccessModal").then((m) => m.SuccessModal));

function RegisterButton({ label = "Register Now" }: { label?: string }) {
  const { openRegister } = useRegisterModal();
  return (
    <button type="button" className="aim-btn" onClick={openRegister}>
      {label}
    </button>
  );
}

function CommunityButton() {
  return (
    <a className="aim-btn aim-btn-ghost" href={AI_MASTERMIND.communityUrl} target="_blank" rel="noopener noreferrer">
      Join AI Community
    </a>
  );
}

const noopSubscribe = () => () => {};

/** Computed in the browser so the date is always "today", not frozen at build time. */
function NextSessionDate() {
  const label = useSyncExternalStore(noopSubscribe, () => getNextSessionLabel(), () => AI_MASTERMIND.fallbackLabel);
  return <>{label}</>;
}

/** Sample reviews are fictional placeholders: visible in local dev, and on a deployed site only if
 *  NEXT_PUBLIC_SHOW_SAMPLE_REVIEWS=true is set on purpose (e.g. staging). Never shown in plain production. */
const SHOW_SAMPLES = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_SAMPLE_REVIEWS === "true";

function Page() {
  const wallReviews = reviews.length > 0 ? reviews : SHOW_SAMPLES ? sampleReviews : [];
  const usingSamples = reviews.length === 0 && wallReviews.length > 0;
  return (
    <div className="aim-root">
      <section className="aim-hero">
        <div className="aim-hero-card">
          <div className="aim-fx" aria-hidden="true">
            <div className="aim-fx-maze" />
            <div className="aim-fx-beam" />
            <div className="aim-fx-glow" />
            <div className="aim-fx-grain" />
            {Array.from({ length: 14 }).map((_, i) => (
              <i key={i} className="aim-fx-dust" style={{ left: `${52 + ((i * 37) % 44)}%`, animationDelay: `${(i * 0.9) % 7}s`, animationDuration: `${6 + (i % 5)}s` }} />
            ))}
          </div>
          <span className="aim-tag">1 DAY ◆ 7 LIVE EXPERT MODULES</span>
          <h1>1 Day AI Mastermind</h1>
          <p>
            Build your own AI-driven apps, automate your work and put AI agents to use. Master AI coding agents,
            automation, AI agents and data analysis — live, hands-on, in a single day.
          </p>
          <dl className="aim-meta">
            <div><dt>Next Session</dt><dd><NextSessionDate /></dd></div>
            <div><dt>Format</dt><dd>{AI_MASTERMIND.format}</dd></div>
            <div><dt>Seat Price</dt><dd>₹{AI_MASTERMIND.priceInr}</dd></div>
          </dl>
          <div className="aim-cta-row">
            <RegisterButton />
            <CommunityButton />
          </div>
        </div>
      </section>

      <section className="aim-section">
        <p className="aim-eyebrow">THE DAY&apos;S SCHEDULE</p>
        <h2>One day will change everything</h2>
        <p className="aim-sub">One day. Seven expert modules. One transformed you.</p>
        <ol className="aim-pills">
          {sessions.map((s) => (
            <li key={s.n}><span>{s.n}</span>{s.short}</li>
          ))}
        </ol>
        <div className="aim-sessions">
          {sessions.map((s) => (
            <article key={s.n} className="aim-session">
              <p className="aim-slot">{s.slot}</p>
              <h3>{s.title}</h3>
              <p className="aim-blurb">{s.blurb}</p>
              <ul>
                {s.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="aim-section">
        <p className="aim-eyebrow">REAL PEOPLE. REAL LEARNING.</p>
        <h2>A look inside our sessions &amp; community</h2>
        <div className="aim-gallery">
          {galleryPhotos.map((g) => (
            <figure key={g.src} className={g.tall ? "aim-tall" : "aim-wide"}>
              <Image src={g.src} alt={g.alt} width={g.w} height={g.h} sizes="(max-width: 640px) 100vw, 33vw" />
            </figure>
          ))}
        </div>
      </section>

      {certificateSrc && (
        <section className="aim-section">
          <p className="aim-eyebrow">CERTIFICATE</p>
          <h2>Take home a certificate</h2>
          <p className="aim-sub">Complete the day and add it to your profile. Sample shown below.</p>
          <figure className="aim-cert">
            <Image src={certificateSrc} alt={certificateAlt} width={2000} height={1221} sizes="(max-width: 900px) 100vw, 900px" />
          </figure>
          <p className="aim-cert-dl"><a href={certificatePdf} target="_blank" rel="noopener noreferrer">View sample certificate (PDF)</a></p>
        </section>
      )}

      {wallReviews.length > 0 && (
        <section className="aim-section">
          <p className="aim-eyebrow">WALL OF LOVE</p>
          <h2>What learners say</h2>
          {usingSamples && (
            <p className="aim-sample-note">
              <span className="aim-sample-tag">SAMPLE</span> Placeholder reviews for layout only — replace with real learner reviews before launch.
            </p>
          )}
          <div className="aim-grid aim-reviews">
            {wallReviews.map((r) => (
              <blockquote key={r.name} className="aim-card">
                {usingSamples && <span className="aim-sample-tag">SAMPLE</span>}
                <p className="aim-quote">&ldquo;{r.quote}&rdquo;</p>
                <h3>{r.name}</h3>
                <p>{r.role}</p>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      <section className="aim-section" id="pricing">
        <p className="aim-eyebrow">YOUR SEAT</p>
        <h2>One day. One small investment.</h2>
        <div className="aim-price">
          <div>
            <p className="aim-price-amt">₹{AI_MASTERMIND.priceInr}<span> / seat</span></p>
            <p className="aim-price-note">All seven live modules included</p>
            <RegisterButton label={`Register for ₹${AI_MASTERMIND.priceInr}`} />
          </div>
          <ul>{pricePoints.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </section>

      <section className="aim-section">
        <p className="aim-eyebrow">AI FOR ALL STAGES</p>
        <h2>Who is this for?</h2>
        <div className="aim-grid">
          {audiences.map((a) => (
            <div key={a.t} className="aim-card"><h3>{a.t}</h3><p>{a.d}</p></div>
          ))}
        </div>
      </section>

      <section className="aim-section">
        <p className="aim-eyebrow">HANDS-ON WITH REAL TOOLS</p>
        <h2>Master the tools of the trade</h2>
        <div className="aim-tools">
          {tools.map((t) => <span key={t}>{t}</span>)}
        </div>
      </section>

      <section className="aim-section aim-faq">
        <p className="aim-eyebrow">COMMON QUESTIONS</p>
        <h2>Everything you&apos;re wondering about</h2>
        {faqs.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
        <div className="aim-final aim-cta-row"><RegisterButton label="Reserve My Seat" /><CommunityButton /></div>
      </section>
    </div>
  );
}

export function AiMastermindLandingPage() {
  return (
    <RegisterModalProvider leadProgram={AI_MASTERMIND.leadProgram} leadSource={AI_MASTERMIND.leadSource} leadBadge={AI_MASTERMIND.leadBadge} seatWord="Seat">
      <Page />
      <RegistrationModal />
      <SuccessModal />
    </RegisterModalProvider>
  );
}
