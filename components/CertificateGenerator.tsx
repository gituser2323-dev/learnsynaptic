'use client';

import { useEffect, useState } from 'react';
import { Download, Pencil, RefreshCw } from 'lucide-react';

const PROGRAMS = [
  'GenAI Mastermind',
  'Generative AI Mastermind',
  'AI Full Stack Engineering',
  'Data Analytics & BI',
];

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function newCertificateNumber() {
  const serial = String(Math.floor(Math.random() * 9000) + 1000);
  return `LS-CERT-${new Date().getFullYear()}-${serial}`;
}

// "2026-06-06" -> "JUNE 06, 2026" (parsed by hand so timezones can't shift the day)
function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${MONTHS[Number(m) - 1]} ${d}, ${y}`;
}

export function CertificateGenerator({
  programs = PROGRAMS,
  variant = 'detailed',
}: {
  programs?: string[];
  // 'detailed' shows start date + serial no.; 'simple' is name and program only.
  variant?: 'detailed' | 'simple';
}) {
  const simple = variant === 'simple';
  const [name, setName] = useState('');
  const [program, setProgram] = useState(programs[0]);
  const [startDate, setStartDate] = useState('');
  // Random, so it must be generated after mount: doing it during render gives
  // the server and the browser different numbers (hydration mismatch).
  const [certNo, setCertNo] = useState('');
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setCertNo(newCertificateNumber()), 0);
    return () => clearTimeout(id);
  }, []);

  const canGenerate =
    name.trim() && program.trim() && (simple || (startDate && certNo.trim()));

  const shown = {
    name: name.trim() || 'Student Name',
    program: program.trim() || 'Program Name',
    date: formatDate(startDate) || 'MONTH 00, 0000',
    certNo: certNo.trim() || 'LS-CERT-0000-0000',
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print {
          body * { visibility: hidden !important; }
          #certificate, #certificate * { visibility: visible !important; }
          #certificate { position: fixed; left: 0; top: 0; width: 297mm; border: 0 !important; }
        }
      `}</style>

      {!generated && (
      <div className="mx-auto max-w-[560px]">
        <div className="mb-6 text-center">
          <span className="ls-badge mb-4 inline-flex">Step 1 of 2</span>
          <h1
            className="text-3xl font-extrabold lg:text-4xl"
            style={{ color: 'var(--ls-text)', letterSpacing: '-0.02em' }}
          >
            Get Your Certificate
          </h1>
          <p className="mt-3 text-base" style={{ color: 'var(--ls-muted)' }}>
            Enter your details to generate your LearnSynaptic Certificate of Completion.
          </p>
        </div>
      <form
        className="grid gap-5 rounded-2xl border bg-white p-6 sm:p-8"
        style={{ borderColor: 'var(--ls-border)' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (canGenerate) setGenerated(true);
        }}
      >
        <Field label="Student name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pratik Sabale"
            className="ls-cert-input"
          />
        </Field>
        <Field label="Program name">
          <input
            required
            list="cert-programs"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            className="ls-cert-input"
          />
          <datalist id="cert-programs">
            {programs.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        {!simple && (
        <>
        <Field label="Start date">
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="ls-cert-input"
          />
        </Field>
        <Field label="Certificate no.">
          <div className="flex gap-2">
            <input
              required
              value={certNo}
              onChange={(e) => setCertNo(e.target.value)}
              className="ls-cert-input"
            />
            <button
              type="button"
              aria-label="Generate a new certificate number"
              onClick={() => setCertNo(newCertificateNumber())}
              className="shrink-0 rounded-lg border px-3"
              style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-text)' }}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </Field>
        </>
        )}

        <div>
          <button
            type="submit"
            disabled={!canGenerate}
            className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--ls-blue-primary)' }}
          >
            Get my certificate
          </button>
        </div>
        <style>{`
          .ls-cert-input { width: 100%; border: 1px solid var(--ls-border); border-radius: 8px; padding: 10px 12px; font-size: 15px; background: #fff; }
          .ls-cert-input:focus { outline: 2px solid var(--ls-blue-primary); outline-offset: 1px; }
        `}</style>
      </form>
      </div>
      )}

      {generated && (
        <>
          <div className="mb-8 text-center">
            <span className="ls-badge mb-4 inline-flex">Step 2 of 2</span>
            <h1
              className="text-3xl font-extrabold lg:text-4xl"
              style={{ color: 'var(--ls-text)', letterSpacing: '-0.02em' }}
            >
              Congratulations, {shown.name.split(' ')[0]}!
            </h1>
            <p className="mt-3 text-base" style={{ color: 'var(--ls-muted)' }}>
              Your certificate is ready. Download it or share it with your network.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--ls-border)' }}>
            <Certificate {...shown} simple={simple} />
          </div>

          <div className="mt-8 text-center">
            <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--ls-text)' }}>
              Share on your platforms
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText({ program: shown.program, certNo: simple ? undefined : shown.certNo }) + ' ' + shareUrl())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-5 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-text)' }}
              >
                <WhatsAppIcon /> WhatsApp
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-5 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-text)' }}
              >
                <LinkedInIcon /> LinkedIn
              </a>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white"
                style={{ background: 'var(--ls-blue-primary)' }}
              >
                <Download size={16} /> Download / Print PDF
              </button>
              <button
                type="button"
                onClick={() => setGenerated(false)}
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-6 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-text)' }}
              >
                <Pencil size={16} /> Edit details
              </button>
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--ls-muted)' }}>
              In the print dialog choose &ldquo;Save as PDF&rdquo; and turn off headers and footers.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function shareText({ program, certNo }: { program: string; certNo?: string }) {
  return `I just completed ${program} at LearnSynaptic!${certNo ? ` Certificate no. ${certNo}.` : ''}`;
}

// Certificates are generated in the browser, so there is no per-certificate
// page to link to. Sharing points people at the LearnSynaptic site instead.
function shareUrl() {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm5.8 14.1c-.25.7-1.45 1.34-2 1.4-.52.06-1.17.09-1.89-.12-.44-.14-1-.32-1.73-.63-3.04-1.31-5.02-4.37-5.17-4.57-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.06-2.52.28-.3.6-.38.8-.38h.58c.19 0 .43-.07.67.51.25.6.84 2.07.91 2.22.08.15.13.32.03.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.05 1.13 1 2.09 1.32 2.39 1.47.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.35.08.12.08.72-.17 1.42Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-left text-sm font-semibold" style={{ color: 'var(--ls-text)' }}>
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

// Designed on a 1600x980 canvas; every measurement is `u(px)` so it scales
// with the container width on screen and in print.
const u = (px: number) => `calc(100cqw * ${px} / 1600)`;
const INK = '#0f1b3d';
const MUTED = '#9ca3af';

function Certificate({
  name,
  program,
  date,
  certNo,
  simple,
}: {
  name: string;
  program: string;
  date: string;
  certNo: string;
  simple: boolean;
}) {
  const abs = (x: number, y: number): React.CSSProperties => ({
    position: 'absolute',
    left: u(x),
    top: u(y),
    whiteSpace: 'nowrap',
  });
  const nameSize = name.length > 26 ? 30 : name.length > 20 ? 36 : 42;
  // The simple design (bootcampcertificate.pdf) sits lower on the page and
  // drops the date / serial / dedication block.
  const o = simple
    ? { title: 218, proud: 370, nameBase: 523, line: 510, program: 541, bottom: -13 }
    : { title: 205, proud: 316, nameBase: 440, line: 427, program: 440, bottom: 0 };

  return (
    <div style={{ containerType: 'inline-size' }}>
      <div
        id="certificate"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1600 / 980',
          background: '#fff',
          backgroundImage: 'radial-gradient(circle, #f5f7fb 0 31%, transparent 32%)',
          backgroundSize: `${u(114)} ${u(114)}`,
          backgroundPosition: `${u(28)} ${u(23)}`,
          overflow: 'hidden',
          fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
          color: INK,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: u(36),
            border: `${u(8)} solid #2f66ff`,
            pointerEvents: 'none',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/certificate/logo.png" alt="LearnSynaptic" style={{ ...abs(105, 80), width: u(170), mixBlendMode: 'multiply' }} />

        <div style={{ ...abs(113, o.title), fontFamily: 'Georgia, "Times New Roman", serif', fontSize: u(72), lineHeight: 1.1 }}>
          Certificate of Completion
        </div>
        <div style={{ ...abs(115, o.proud), fontSize: u(22) }}>Proudly presented to</div>
        <div style={{ ...abs(114, o.nameBase - nameSize - 18), fontSize: u(nameSize), fontWeight: 800, lineHeight: 1.1 }}>{name}</div>
        <div style={{ ...abs(115, o.line), width: u(753), height: u(1.5), background: '#c9ced8' }} />
        <div style={{ ...abs(114, o.program), fontSize: u(22), display: 'flex', alignItems: 'baseline', gap: u(10) }}>
          <span>for successfully completing</span>
          <strong style={{ fontSize: u(26), fontWeight: 800 }}>{program}</strong>
        </div>

        {!simple && (
          <>
        <div style={{ ...abs(119, 520), fontSize: u(20), fontWeight: 700 }}>{date}</div>
        <div style={{ ...abs(119, 550), fontSize: u(17), fontWeight: 600, color: MUTED }}>Start Date</div>
        <div style={{ ...abs(332, 520), fontSize: u(20), fontWeight: 700 }}>{certNo}</div>
        <div style={{ ...abs(332, 550), fontSize: u(17), fontWeight: 600, color: MUTED }}>Serial No.</div>

        <div style={{ ...abs(122, 620), fontSize: u(14), fontStyle: 'italic', fontWeight: 600, color: MUTED }}>Dedicated to</div>
        <div style={{ ...abs(119, 648), fontSize: u(21), fontWeight: 700 }}>
          &ldquo;Excellence in Practical AI Education&rdquo;
        </div>
        <div style={{ ...abs(122, 680), fontSize: u(14), fontStyle: 'italic', fontWeight: 600, color: MUTED }}>
          LearnSynaptic AI Engineering Academy
        </div>

          </>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/certificate/seal.png" alt="" style={{ ...abs(125, 735 + o.bottom), width: u(130), mixBlendMode: 'multiply' }} />
        <div style={{ ...abs(126, 843 + o.bottom), fontSize: u(21), fontWeight: 800 }}>PRATIK SABALE</div>
        <div style={{ ...abs(126, 867 + o.bottom), fontSize: u(21), fontWeight: 700, color: MUTED }}>Co-Founder</div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/certificate/stamp.png" alt="" style={{ ...abs(1205 + (simple ? 57 : 0), 670 + (simple ? 7 : 0)), width: u(205), mixBlendMode: 'multiply' }} />
      </div>
    </div>
  );
}
