'use client'

export function EmptyPlanIllustration({ className = '', size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="epi-book" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-primary-mid)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="epi-pad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--color-surface)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-surface-alt)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="epi-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-danger-mid)" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <rect x="16" y="28" width="32" height="52" rx="4" fill="url(#epi-book)" transform="rotate(-8 32 54)" />
      <rect x="20" y="32" width="24" height="44" rx="2" fill="var(--color-primary-soft)" transform="rotate(-8 32 54)" />
      <line x1="26" y1="40" x2="40" y2="39" stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round" transform="rotate(-8 32 54)" />
      <line x1="26" y1="46" x2="40" y2="45" stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round" transform="rotate(-8 32 54)" />
      <line x1="26" y1="52" x2="36" y2="51" stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round" transform="rotate(-8 32 54)" />

      <rect x="44" y="36" width="52" height="60" rx="6" fill="url(#epi-pad)" stroke="var(--color-line-strong)" strokeWidth="1.5" />
      <rect x="48" y="40" width="44" height="3" rx="1.5" fill="url(#epi-accent)" />
      <line x1="54" y1="54" x2="88" y2="54" stroke="var(--color-line)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="54" y1="62" x2="84" y2="62" stroke="var(--color-line)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="54" y1="70" x2="80" y2="70" stroke="var(--color-line)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="54" y1="78" x2="76" y2="78" stroke="var(--color-line)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="84" cy="86" r="7" fill="url(#epi-accent)" />
      <path d="M81 86 L83.5 88.5 L87.5 84.5" stroke="var(--color-white)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      <rect x="74" y="18" width="28" height="48" rx="4" fill="var(--color-course-accent)" transform="rotate(10 88 42)" opacity="0.92" />
      <rect x="78" y="22" width="20" height="40" rx="2" fill="var(--color-primary-soft)" transform="rotate(10 88 42)" />
      <line x1="82" y1="30" x2="96" y2="29" stroke="var(--color-primary)" strokeWidth="1.2" strokeLinecap="round" transform="rotate(10 88 42)" />
      <line x1="82" y1="36" x2="94" y2="35" stroke="var(--color-primary)" strokeWidth="1.2" strokeLinecap="round" transform="rotate(10 88 42)" />
      <line x1="82" y1="42" x2="90" y2="41" stroke="var(--color-primary)" strokeWidth="1.2" strokeLinecap="round" transform="rotate(10 88 42)" />
    </svg>
  )
}

export function ErrorIllustration({ className = '', size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="erri-cloud" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="var(--color-primary-soft)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-canvas-soft)" stopOpacity="1" />
        </radialGradient>
        <linearGradient id="erri-star" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-danger-mid)" stopOpacity="1" />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="54" rx="40" ry="26" fill="url(#erri-cloud)" />
      <ellipse cx="42" cy="60" rx="20" ry="16" fill="url(#erri-cloud)" />
      <ellipse cx="78" cy="60" rx="20" ry="16" fill="url(#erri-cloud)" />
      <ellipse cx="58" cy="46" rx="22" ry="16" fill="url(#erri-cloud)" />

      <g transform="translate(60 72)">
        <path
          d="M0 -22 L6.3 -6.8 L22 -6.8 L9.5 2.6 L14.6 18 L0 8.8 L-14.6 18 L-9.5 2.6 L-22 -6.8 L-6.3 -6.8 Z"
          fill="url(#erri-star)"
        />
        <circle cx="-5" cy="-4" r="2.2" fill="var(--color-ink)" />
        <circle cx="5" cy="-4" r="2.2" fill="var(--color-ink)" />
        <path d="M-5 5 Q0 2 5 5" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </g>

      <circle cx="24" cy="28" r="2.4" fill="var(--color-primary)" opacity="0.55" />
      <circle cx="96" cy="32" r="1.8" fill="var(--color-accent)" opacity="0.55" />
      <circle cx="104" cy="86" r="2.2" fill="var(--color-course-accent)" opacity="0.5" />
      <circle cx="18" cy="88" r="1.6" fill="var(--color-primary)" opacity="0.45" />
    </svg>
  )
}

export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`havan-loading-dots ${className}`} aria-label="Loading" role="status">
      <span />
      <span />
      <span />
      <style jsx>{`
        .havan-loading-dots {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .havan-loading-dots span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-primary);
          animation: havan-dot-bounce 1.2s ease-in-out infinite;
        }
        .havan-loading-dots span:nth-child(2) {
          background: var(--color-accent);
          animation-delay: 0.15s;
        }
        .havan-loading-dots span:nth-child(3) {
          background: var(--color-course-accent);
          animation-delay: 0.3s;
        }
        @keyframes havan-dot-bounce {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .havan-loading-dots span {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </span>
  )
}

export function CheckIcon({ className = '', size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <circle cx="10" cy="10" r="10" fill="var(--color-success)" />
      <path
        d="M6 10.2 L9 13.2 L14.2 7.4"
        stroke="var(--color-white)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StreakIcon({ className = '', size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="si-flame" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="var(--color-danger-deep)" stopOpacity="1" />
          <stop offset="40%" stopColor="var(--color-accent)" stopOpacity="1" />
          <stop offset="75%" stopColor="var(--color-warn)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-warn-soft)" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path
        d="M10 1.5 C10 1.5 5.5 5.8 5.5 10.6 C5.5 13.4 7.5 15.5 10 15.5 C12.5 15.5 14.5 13.4 14.5 10.6 C14.5 7.5 12.8 6 12.5 4 C12.3 5.4 11.2 6.2 11.2 7.7 C11.2 8.8 10.5 9.5 10 9.5 C10 7 10 4 10 1.5 Z"
        fill="url(#si-flame)"
      />
      <path
        d="M10 10.6 C10 10.6 8.5 11.5 8.5 13 C8.5 13.8 9.1 14.3 10 14.3 C10.9 14.3 11.5 13.8 11.5 13 C11.5 12.2 11 11.8 10.8 11.1 C10.7 12 10.2 12.3 10 12.3 Z"
        fill="var(--color-warn-soft)"
        opacity="0.9"
      />
    </svg>
  )
}
