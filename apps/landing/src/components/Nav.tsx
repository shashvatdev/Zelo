export function Logo() {
  return (
    <a href="#top" className="logo" aria-label="Zelo home">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <path
          d="M13 6.5 L6 19 M13 6.5 L20 19"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="13" cy="5.5" r="3.6" fill="currentColor" />
        <circle
          cx="6"
          cy="20"
          r="3.2"
          fill="var(--paper)"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="20" cy="20" r="3.2" fill="var(--coral)" />
      </svg>
      <span>zelo</span>
    </a>
  );
}

export default function Nav() {
  return (
    <header className="nav">
      <Logo />
      <nav aria-label="Main">
        <a href="#problem">Why</a>
        <a href="#how">How it works</a>
        <a href="#ai">AI</a>
        <a href="#compare">Compare</a>
        <a href="#faq">FAQ</a>
      </nav>
      <a href="#waitlist" className="btn btn-ink btn-sm">
        Join the waitlist
      </a>
    </header>
  );
}
