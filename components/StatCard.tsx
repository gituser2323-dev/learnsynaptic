// Server component — hover effects handled entirely by CSS (.stat-cell, .stat-number, .stat-accent)
// This avoids the Next.js RSC boundary issue (LucideIcon functions can't be serialised to client)
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  value: string;
  label: string;
  Icon: LucideIcon;
  green?: boolean;
}

export function StatCard({ value, label, Icon, green }: StatCardProps) {
  const numColor = green ? '#86efac' : '#fff';
  const accentColor = green ? '#86efac' : 'rgba(255,255,255,0.75)';

  return (
    <div className="stat-cell flex flex-col items-center text-center">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ background: 'rgba(255,255,255,0.15)' }}
      >
        <Icon size={20} color={numColor} />
      </div>

      {/* Number + accent line are siblings inside an inline-block wrapper
          so the accent line width:100% is relative to the number span width */}
      <div style={{ display: 'inline-block', marginBottom: '4px' }}>
        <span
          className="stat-number block text-4xl lg:text-5xl font-bold"
          style={{ color: numColor, letterSpacing: '-0.02em' }}
        >
          {value}
        </span>
        <div
          className="stat-accent"
          style={{ background: accentColor }}
          aria-hidden
        />
      </div>

      <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
        {label}
      </span>
    </div>
  );
}
