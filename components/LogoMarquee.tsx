const partners = [
  'Wipro', 'TCS', 'Infosys', 'Deloitte', 'Accenture',
  'Cognizant', 'HCL', 'Tech Mahindra', 'Persistent Systems', 'KPMG',
  'IBM', 'Oracle', 'Capgemini', 'Mphasis', 'Hexaware',
];

export function LogoMarquee() {
  return (
    <div
      style={{
        background: '#fff',
        borderTop: '1px solid var(--ls-border)',
        borderBottom: '1px solid var(--ls-border)',
        padding: '22px 0',
      }}
    >
      {/* Label */}
      <p
        style={{
          textAlign: 'center',
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ls-muted)',
          marginBottom: 14,
          opacity: 0.7,
        }}
      >
        Our graduates are now at
      </p>

      {/* Scroll strip */}
      <div style={{ overflow: 'hidden', position: 'relative' }}>
        {/* Fade edges */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 80,
            background: 'linear-gradient(to right, #fff, transparent)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 80,
            background: 'linear-gradient(to left, #fff, transparent)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        <div className="ls-marquee-track">
          {/* Two identical copies for seamless loop */}
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="ls-marquee-inner"
              aria-hidden={copy === 1 ? true : undefined}
            >
              {partners.map((name) => (
                <div
                  key={name}
                  style={{
                    padding: '7px 22px',
                    border: '1.5px solid var(--ls-border)',
                    borderRadius: 10,
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--ls-text)',
                    opacity: 0.38,
                    filter: 'grayscale(1)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.01em',
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
