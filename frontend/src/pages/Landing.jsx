import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import './Landing.css';

// ---------------------------------------------------------------------------
// Public marketing landing page (route "/"). CTAs point into the app:
// "Log in" → /login, "Post a job" / "Find work near you" → /register.
// ---------------------------------------------------------------------------

const Star = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="#F2A93B">
    <path d="M10 1l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z" />
  </svg>
);

const Check = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M5 13l4 4L19 7"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShieldCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const Calendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PlusCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TrustCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke="#F2A93B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Clock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 6v6l4 2" stroke="#F2A93B" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="9" stroke="#F2A93B" strokeWidth="2" />
  </svg>
);

const PaySlip = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="6" width="18" height="13" rx="2" stroke="#F2A93B" strokeWidth="2" />
    <path d="M3 10h18" stroke="#F2A93B" strokeWidth="2" />
  </svg>
);

const Rating = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M10 1l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z"
      stroke="#F2A93B"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="#fff" strokeWidth="2" />
    <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Reveals `.reveal` elements as they scroll into view. Falls back to showing
 * everything immediately when IntersectionObserver is unavailable (and in
 * jsdom tests).
 */
function useRevealOnScroll() {
  useEffect(() => {
    const els = document.querySelectorAll('.landing .reveal');
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('visible'));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export default function Landing() {
  useRevealOnScroll();

  return (
    <div className="landing">
      <header>
        <nav className="wrap">
          <div className="logo">
            <Logo variant="dot" size={9} />
            Domestic Connects
          </div>
          <div className="nav-links">
            <a href="#workers">For workers</a>
            <a href="#how">How it works</a>
            <a href="#households">For households</a>
          </div>
          <div className="nav-cta">
            <ThemeToggle />
            <Link to="/login" className="btn-ghost">
              Log in
            </Link>
            <Link to="/register" className="btn btn-primary">
              Post a job
            </Link>
          </div>
          <button type="button" className="menu-toggle" aria-label="Menu">
            ☰
          </button>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">Trusted by households &amp; domestic workers</span>
              <h1>
                Reliable help,
                <br />
                <em>verified</em> before they knock.
              </h1>
              <p className="lede">
                Domestic Connects matches households with background-checked
                domestic workers — and handles attendance, payslips and
                reviews, so neither of you has to chase paperwork.
              </p>
              <div className="hero-actions">
                <Link to="/register" className="btn btn-primary">
                  Post a job
                </Link>
                <Link to="/register" className="btn btn-outline">
                  Find work near you
                </Link>
              </div>
              <div className="hero-trust">
                <span>
                  <ShieldCheck />
                  Identity checked
                </span>
                <span>
                  <Calendar />
                  Attendance tracked
                </span>
                <span>
                  <PlusCircle />
                  Paid on time
                </span>
              </div>
            </div>

            <div className="card-stage">
              <div className="backcard" aria-hidden="true" />
              <div className="verified-card">
                <div className="badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#14231F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Verified
                </div>
                <div className="avatar-ring">
                  <PersonIcon />
                </div>
                <h3>Meera K.</h3>
                <p className="role">Housekeeping &amp; cooking</p>
                <div className="stars" aria-label="4.9 out of 5 stars">
                  <Star />
                  <Star />
                  <Star />
                  <Star />
                  <Star />
                </div>
                <div className="stats">
                  <div className="stat">
                    <b>128</b>
                    <span>Jobs done</span>
                  </div>
                  <div className="stat">
                    <b>4.9</b>
                    <span>Rating</span>
                  </div>
                  <div className="stat">
                    <b>2 yrs</b>
                    <span>On platform</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="dot-divider" aria-hidden="true">
            <span className="filled" />
            <span className="filled" />
            <span className="filled" />
            <span className="filled" />
            <span className="filled" />
            <span />
            <span />
          </div>
        </section>

        <div className="trust-strip">
          <div className="wrap">
            <div className="trust-item">
              <TrustCheck />
              Every worker background-checked
            </div>
            <div className="trust-item">
              <Clock />
              Attendance logged automatically
            </div>
            <div className="trust-item">
              <PaySlip />
              Payslips generated monthly
            </div>
            <div className="trust-item">
              <Rating />
              Ratings that carry job to job
            </div>
          </div>
        </div>

        <section id="how">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">How it works</span>
              <h2>Three steps, start to finish</h2>
              <p>No agencies, no phone tag — post, match and manage it all in one place.</p>
            </div>
            <div className="steps">
              <div className="step reveal">
                <span className="num">01</span>
                <h3>Post what you need</h3>
                <p>Describe the job, the hours, and the pay. It&apos;s live in minutes.</p>
              </div>
              <div className="step reveal">
                <span className="num">02</span>
                <h3>Get matched with a vetted worker</h3>
                <p>Every worker on the platform is background-checked and rated by past employers.</p>
              </div>
              <div className="step reveal">
                <span className="num">03</span>
                <h3>Track it, pay it, rate it</h3>
                <p>Attendance, payslips and reviews all happen right inside the app.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="households" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="two-col">
              <div className="feat-card household reveal">
                <span className="tag">For households</span>
                <h3>Hire with confidence</h3>
                <ul className="feat-list">
                  <li>
                    <Check /> Every worker is checked before their first day
                  </li>
                  <li>
                    <Check /> Attendance is logged automatically — no chasing timesheets
                  </li>
                  <li>
                    <Check /> Payslips generate themselves each month
                  </li>
                  <li>
                    <Check /> Rate and review after every job
                  </li>
                </ul>
              </div>
              <div className="feat-card worker reveal" id="workers">
                <span className="tag">For workers</span>
                <h3>Build steady, visible work</h3>
                <ul className="feat-list">
                  <li>
                    <Check /> Get matched to steady work near you
                  </li>
                  <li>
                    <Check /> Get paid on time, with a payslip you can show anywhere
                  </li>
                  <li>
                    <Check /> Build a rating that speaks for you
                  </li>
                  <li>
                    <Check /> Your profile is verified once, trusted everywhere
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Trusted both ways</span>
              <h2>What people say</h2>
            </div>
            <div className="quotes">
              <div className="quote-card reveal">
                <p className="q">
                  &ldquo;I stopped worrying about who was walking into my home. The verification
                  and the reviews made the decision for me.&rdquo;
                </p>
                <div className="quote-who">
                  <div className="dot-avatar" aria-hidden="true" />
                  <div>
                    <b>Anitha R.</b>
                    <span>Household, Hyderabad</span>
                  </div>
                </div>
              </div>
              <div className="quote-card reveal">
                <p className="q">
                  &ldquo;My rating gets me hired faster than any reference letter ever did — and I
                  always know my payslip is right.&rdquo;
                </p>
                <div className="quote-who">
                  <div className="dot-avatar" aria-hidden="true" />
                  <div>
                    <b>Meera K.</b>
                    <span>Housekeeping worker</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="final-cta reveal">
          <h2>Ready to find reliable help — or reliable work?</h2>
          <p>Join Domestic Connects and let verification, attendance and pay take care of themselves.</p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary">
              Post a job
            </Link>
            <Link to="/register" className="btn btn-outline">
              Find work near you
            </Link>
          </div>
        </div>
      </main>

      <footer>
        <div className="wrap">
          <div className="logo" style={{ fontSize: '1.05rem' }}>
            <Logo variant="dot" size={9} />
            Domestic Connects
          </div>
          <div className="flinks">
            <a href="#how">How it works</a>
            <a href="#households">For households</a>
            <a href="#workers">For workers</a>
          </div>
          <span>© 2026 Domestic Connects</span>
        </div>
      </footer>
    </div>
  );
}
