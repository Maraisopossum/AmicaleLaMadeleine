export function IconFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="#0866FF" />
      <path
        fill="#fff"
        d="M23.5 18.5h-3.7V30h-4.6V18.5h-2.6v-3.9h2.6v-2.8c0-3.2 1.6-5.1 5.4-5.1h3.3v3.9h-2.1c-1.5 0-1.6.6-1.6 1.6v2.4h3.7l-.4 3.9Z"
      />
    </svg>
  )
}

export function IconInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FCAF45" />
          <stop offset="25%" stopColor="#E1306C" />
          <stop offset="55%" stopColor="#C13584" />
          <stop offset="80%" stopColor="#833AB4" />
          <stop offset="100%" stopColor="#405DE6" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="9" fill="url(#ig-gradient)" />
      <rect x="9" y="9" width="18" height="18" rx="5" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="18" cy="18" r="4.6" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="24" cy="12" r="1.4" fill="#fff" />
    </svg>
  )
}
