import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, ArrowRight, Bell, CalendarDays, Check, CheckCircle2, ChevronRight,
  HeartPulse, LayoutDashboard, Menu, MessageSquare, MonitorPlay, ShieldCheck,
  Smartphone, Stethoscope, UserRoundCheck, Users, X, Clock3, BarChart3,
  PhoneCall, Mail, MapPin, Star,
} from 'lucide-react'
import heroBackground from '../imports/mediqueue_hero_background.png'
import MolecularParticles from '../components/MolecularParticles'

const patientBenefits = [
  'Book appointments with your preferred doctor',
  'Join live queues before arriving',
  'See real-time waiting estimates',
  'Receive WhatsApp/SMS notifications',
  'Keep your appointment history',
]

const clinicBenefits = [
  'Manage appointments and walk-ins',
  'Coordinate multiple doctors and schedules',
  'Manage live queues in real time',
  'Track revenue and clinic performance',
  'Reduce no-shows and waiting times',
]

const doctorBenefits = [
  'See a focused daily schedule',
  'Manage your personal patient queue',
  'Update consultation status',
  'Access patient history securely',
  'Spend more time caring for patients',
]

function FeatureList({ items, green = false }: { items: string[]; green?: boolean }) {
  return (
    <ul className="marketing-list">
      {items.map((item) => (
        <li key={item}>
          <span className={green ? 'marketing-check green' : 'marketing-check'}>
            <Check size={13} strokeWidth={3} />
          </span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function scrollToSection(id: string, closeMenu?: () => void) {
  closeMenu?.()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 18)
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(scrollableHeight > 0 ? (window.scrollY / scrollableHeight) * 100 : 0)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const revealTargets = document.querySelectorAll<HTMLElement>(
      '.marketing-section, .marketing-cta, .contact-strip, .marketing-footer, ' +
      '.audience-card, .step-card, .feature-detail-grid article, .story-card, .metric-band > div',
    )
    const staggerGroups = document.querySelectorAll<HTMLElement>(
      '.audience-grid, .steps-grid, .feature-detail-grid, .stories-grid, .metric-band',
    )

    revealTargets.forEach((element) => element.classList.add('scroll-reveal'))
    staggerGroups.forEach((group) => {
      Array.from(group.children).forEach((child, index) => {
        const element = child as HTMLElement
        element.classList.add('scroll-reveal')
        element.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 90}ms`)
      })
    })

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })

    revealTargets.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>('.marketing-hero')
    if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = hero.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / bounds.width - 0.5
      const y = (event.clientY - bounds.top) / bounds.height - 0.5
      hero.style.setProperty('--pointer-x', `${x * 18}px`)
      hero.style.setProperty('--pointer-y', `${y * 14}px`)
    }
    const resetPointer = () => {
      hero.style.setProperty('--pointer-x', '0px')
      hero.style.setProperty('--pointer-y', '0px')
    }

    hero.addEventListener('pointermove', handlePointerMove, { passive: true })
    hero.addEventListener('pointerleave', resetPointer)
    return () => {
      hero.removeEventListener('pointermove', handlePointerMove)
      hero.removeEventListener('pointerleave', resetPointer)
    }
  }, [])

  const navTo = (id: string) => scrollToSection(id, () => setMenuOpen(false))
  const goHome = () => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })

  return (
    <main className="marketing-page">
      <div className="landing-scroll-progress" aria-hidden="true">
        <span style={{ height: `${scrollProgress}%` }} />
      </div>
      {/* NAVIGATION */}
      <header className={`marketing-nav${isScrolled ? ' is-scrolled' : ''}`}>
        <Link to="/" className="marketing-brand" aria-label="MediQueue home" onClick={goHome} style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <img src="/logo.png" alt="MediQueue" style={{ height: 70, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          {/*<span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-1)' }}>Medi<span style={{ color: 'var(--blue)' }}>Queue</span></span>*/}
        </Link>

        <nav className="marketing-links" aria-label="Main navigation">
          <button type="button" onClick={() => navTo('home')}>Home</button>
          <button type="button" onClick={() => navTo('patients')}>For Patients</button>
          <button type="button" onClick={() => navTo('clinics')}>For Clinics</button>
          <button type="button" onClick={() => navTo('doctors')}>For Doctors</button>
          <button type="button" onClick={() => navTo('solutions')}>Features</button>
          <button type="button" onClick={() => navTo('stories')}>Testimonials</button>
          <button type="button" onClick={() => navTo('contact')}>Contact</button>
        </nav>

        <div className="marketing-nav-actions">
          <Link to="/login" className="marketing-signin">Sign in</Link>
          <Link to="/register" className="marketing-nav-cta">
            Get started <ArrowRight size={14} />
          </Link>
        </div>

        <button
          className="marketing-menu"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>

      {menuOpen && (
        <nav className={`marketing-mobile-menu${isScrolled ? ' is-scrolled' : ''}`} aria-label="Mobile navigation">
          {[
            ['home', 'Home'],
            ['patients', 'For Patients'],
            ['clinics', 'For Clinics'],
            ['doctors', 'For Doctors'],
            ['solutions', 'Features'],
            ['pricing', 'Pricing'],
            ['stories', 'Testimonials'],
            ['contact', 'Contact'],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => navTo(id)}>{label}</button>
          ))}
          <Link to="/login" onClick={() => setMenuOpen(false)}>Patient sign in</Link>
          <Link to="/staff/login" onClick={() => setMenuOpen(false)}>Staff portal</Link>
          <Link to="/register" onClick={() => setMenuOpen(false)}>Create patient account</Link>
        </nav>
      )}

      {/* HERO */}
      <section id="home" className="marketing-hero">
        <div className="hero-glow" />
        <div className="hero-grid-pattern" />

        <div className="marketing-hero-copy">
          <div className="eyebrow">
            <HeartPulse size={15} /> Smarter healthcare for a healthier tomorrow
          </div>
          <h1>
            Book. Queue. <span>Care.</span><br />
            All in one place.
          </h1>
          <p>
            MediQueue connects patients, doctors, and medical centers in one simple platform —
            making appointments, live queues, and consultations easier for everyone.
          </p>

          <div className="marketing-actions">
            <Link to="/login?new=1" className="marketing-primary">
              Book an appointment <ArrowRight size={16} />
            </Link>
            <button type="button" className="marketing-secondary" onClick={() => navTo('how-it-works')}>
              <span className="play-icon">▶</span> See how it works
            </button>
          </div>

          <div className="hero-trust">
            <span><CheckCircle2 size={15} /> No long waiting rooms</span>
            <span><ShieldCheck size={15} /> Secure by design</span>
            <span><Clock3 size={15} /> Real-time queue updates</span>
          </div>
        </div>

        <div className="marketing-hero-visual">
          <div className="hero-image-wrap">
            <img src={heroBackground} alt="Modern medical center reception" />
          </div>

          <div className="hero-image-overlay" />

          <div className="floating-card next-card">
            <span className="floating-icon green"><Bell size={16} /></span>
            <div>
              <strong>You're next!</strong>
              <small>Please proceed to Room 03</small>
            </div>
            <span className="tiny-muted">now</span>
          </div>

          <div className="floating-card queue-card">
            <div className="queue-card-title">
              <span className="floating-icon blue"><Users size={16} /></span>
              <strong>Live queue</strong>
            </div>
            <b>A19</b>
            <small>Your place is saved</small>
            <div className="queue-time">~ 30 minutes</div>
            <Link to="/login?new=1">Join queue <ArrowRight size={13} /></Link>
          </div>

          <div className="floating-card appointment-card">
            <CalendarDays size={17} />
            <span>
              <strong>Book appointment</strong>
              <small>Choose your doctor and time</small>
            </span>
          </div>

          <div className="hero-note">
            Better care.<br /><b>Happier people.</b><br />Healthier communities.
            <HeartPulse size={17} />
          </div>
        </div>
      </section>

      {/* AUDIENCES */}
      <section id="solutions" className="marketing-section intro-section">
        <div className="section-heading">
          <div className="eyebrow centered">One platform. Every care journey.</div>
          <h2>A smarter experience <span>for everyone</span></h2>
          <p>Whether you are a patient, doctor, receptionist, or clinic owner, MediQueue gives you the tools you need in one connected healthcare platform.</p>
        </div>

        <div className="audience-grid">
          <article className="audience-card patient-card">
            <div className="audience-icon"><Users size={22} /></div>
            <h3>For patients</h3>
            <p>Book, queue, and stay informed without spending your day sitting in a waiting room.</p>
            <FeatureList items={patientBenefits} />
            <Link to="/register" className="text-link">Create patient account <ArrowRight size={15} /></Link>
          </article>

          <article className="audience-card clinic-card">
            <div className="audience-icon"><LayoutDashboard size={22} /></div>
            <h3>For medical centers</h3>
            <p>Run appointments, doctors, walk-ins, queues, and clinic performance from one dashboard.</p>
            <FeatureList items={clinicBenefits} />
            <Link to="/staff/register/medical-center" className="text-link">Register your center <ArrowRight size={15} /></Link>
          </article>

          <article className="audience-card doctor-card">
            <div className="audience-icon"><Stethoscope size={22} /></div>
            <h3>For doctors</h3>
            <p>A focused workspace that keeps your schedule, patient queue, and consultation flow clear.</p>
            <FeatureList items={doctorBenefits} green />
            <Link to="/staff/login" className="text-link green-link">Open doctor portal <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>

      {/* PATIENT */}
      <section id="patients" className="marketing-section split-section patient-split">
        <div className="split-copy">
          <div className="eyebrow">For patients</div>
          <h2>Your health.<br /><span>Your time.</span></h2>
          <p>
            Find your doctor, book an appointment, join a live queue remotely, and receive updates before your turn — without guessing when to leave home.
          </p>
          <FeatureList items={patientBenefits} />
          <div className="store-buttons">
            <span><Smartphone size={17} /> Available on web</span>
            <span><MessageSquare size={16} /> WhatsApp & SMS updates</span>
          </div>
          <Link to="/register" className="marketing-primary compact">Create patient account <ArrowRight size={15} /></Link>
        </div>

        <div className="phone-demo" aria-label="MediQueue patient app preview">
          <div className="phone-stage">
            <div className="phone-shell phone-primary">
              <div className="phone-top">MediQueue <span>9:41</span></div>
              <div className="phone-greeting">Good morning,<br /><b>Tharushi Silva</b></div>
              <div className="phone-search">Search doctors or specialties...</div>
              <div className="phone-action-grid">
                <div><CalendarDays size={18} /><small>Book appointment</small></div>
                <div><Users size={18} /><small>Join live queue</small></div>
                <div><Clock3 size={18} /><small>My appointments</small></div>
                <div><MapPin size={18} /><small>Find a clinic</small></div>
              </div>
              <div className="phone-panel">
                <small>UPCOMING APPOINTMENT</small>
                <b>Dr. Aisha Patel</b>
                <span>Today · 10:30 AM</span>
                <div className="phone-progress"><span /></div>
                <em>Arrive in about 25 min</em>
              </div>
            </div>

            <div className="phone-shell phone-secondary">
              <div className="phone-top"><span>‹</span><b>Live Queue</b><span>•••</span></div>
              <div className="queue-clinic">
                <span className="queue-clinic-icon"><Activity size={15} /></span>
                <div><b>City Care Medical Center</b><small>Dr. Aisha Patel · General Medicine</small></div>
              </div>
              <div className="queue-serving">
                <small>Currently serving</small>
                <strong>A19</strong>
                <span>5<br /><small>patients waiting</small></span>
              </div>
              <div className="queue-tokens"><span>A20</span><span>A21</span><span>A22</span><span>A23</span><span>A24</span></div>
              <div className="queue-estimate">
                <Bell size={14} />
                <span>Estimated waiting time<strong>~ 35–45 minutes</strong></span>
              </div>
              <small className="queue-hint">You'll receive a notification when you're 2 patients away.</small>
            </div>
          </div>

          <div className="phone-queue"><Users size={17} /><b>Live Queue</b><strong>A19</strong><small>~ 35–45 min</small></div>
          <div className="patient-whatsapp-card"><MessageSquare size={15} /><span><b>You're next!</b><small>Please proceed to your doctor's room.</small></span></div>
          <div className="demo-caption"><span className="demo-pulse" /> Live patient experience</div>
          <div className="demo-steps"><span><b>01</b>Book</span><span><b>02</b>Join queue</span><span><b>03</b>Arrive on time</span></div>
        </div>
      </section>

      {/* CLINIC */}
      <section id="clinics" className="marketing-section split-section clinic-split">
        <div className="dashboard-stage">
          <div className="dashboard-window">
            <div className="dash-sidebar">
              <b style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <img src="/logo.png" alt="" style={{ height: 16, width: 'auto', objectFit: 'contain' }} /> MediQueue
              </b>
              <span className="active">Overview</span><span>Appointments</span><span>Live queue</span>
              <span>Patients</span><span>Doctors</span><span>Reports</span>
            </div>
            <div className="dash-main">
              <div className="dash-top"><span>Good morning, <b>City Care Medical Center</b></span><span className="live-pill">● Live</span></div>
              <h4>Today's overview</h4>
              <div className="dash-stats">
                <span><small>Today's patients</small><b>46</b></span>
                <span><small>Completed</small><b className="green-text">38</b></span>
                <span><small>Waiting</small><b>6</b></span>
                <span><small>No-shows</small><b className="red-text">2</b></span>
              </div>
              <div className="dash-finance">
                <span><small>Today's revenue</small><b>Rs. 92,500</b></span>
                <span><small>Avg. wait</small><b>24 min</b></span>
              </div>
              <div className="dash-chart">
                <div><b>Doctor schedule</b><span className="chart-line" /></div>
                <p><strong>Dr. Aisha Patel</strong><small>General Medicine · 6 patients</small><span className="bar"><i /></span></p>
                <p><strong>Dr. Marcus Reeves</strong><small>Cardiology · 4 patients</small><span className="bar"><i className="bar-two" /></span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="split-copy">
          <div className="eyebrow">For medical centers</div>
          <h2>Run your clinic<br /><span>smarter.</span></h2>
          <p>One calm dashboard for appointments, walk-ins, doctors, live queues, revenue, and daily performance.</p>
          <FeatureList items={clinicBenefits} />
          <div className="clinic-roi-card">
            <BarChart3 size={22} />
            <div><b>Make every slot count</b><small>See no-shows, waiting time, doctor utilization and revenue in one place.</small></div>
          </div>
          <Link to="/staff/register/medical-center" className="marketing-primary compact">Register your medical center <ArrowRight size={15} /></Link>
        </div>
        <div className="clinic-growth-note" aria-label="More patients, more revenue">
          <span>More patients<br />more revenue</span>
          <svg viewBox="0 0 92 72" aria-hidden="true">
            <path d="M8 62 C28 62 43 54 51 39 C59 25 69 15 86 10" />
            <path d="M72 8 L86 10 L81 23" />
          </svg>
        </div>
      </section>

      {/* DOCTOR */}
      <section id="doctors" className="marketing-section doctor-role-section">
        <MolecularParticles />
        <div className="doctor-role-visual">
          <div className="doctor-role-card">
            <div className="role-card-top">
              <span className="floating-icon green"><UserRoundCheck size={17} /></span>
              <div><b>Doctor workspace</b><small>Focused care, less admin</small></div>
              <span className="role-live">Ready</span>
            </div>
            <div className="doctor-mini-stats"><span><b>12</b><small>Today</small></span><span><b>4</b><small>Waiting</small></span><span><b>2</b><small>Completed</small></span></div>
            <div className="role-patient">
              <span className="doctor-avatar">TS</span>
              <div><b>Tharushi Silva</b><small>Follow-up · 10:30 AM</small></div>
              <span className="role-tag">Next</span>
            </div>
            <div className="role-actions">
              <span><CheckCircle2 size={15} /> Review history</span>
              <span><MessageSquare size={15} /> Send update</span>
              <span><CalendarDays size={15} /> Plan follow-up</span>
            </div>
          </div>
        </div>
        <div className="split-copy">
          <div className="eyebrow">For doctors</div>
          <h2>More time for<br /><span>what matters.</span></h2>
          <p>MediQueue gives every doctor a focused workspace to prepare, consult, update patient status, and move through the day with less administrative work.</p>
          <FeatureList items={doctorBenefits} green />
          <Link to="/staff/login" className="marketing-primary compact">Open doctor portal <ArrowRight size={15} /></Link>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="marketing-section how-section">
        <div className="section-heading">
          <div className="eyebrow centered">Get started in minutes</div>
          <h2>Simple for patients.<br /><span>Powerful for clinics.</span></h2>
          <p>From account creation to live queue updates, MediQueue keeps every step clear.</p>
        </div>
        <div className="steps-grid">
          {[
            ['01', 'Create your account', 'Sign up as a patient or register your medical center.'],
            ['02', 'Book or manage', 'Book appointments or manage doctors and schedules.'],
            ['03', 'Join and track', 'Join the live queue and receive real-time updates.'],
            ['04', 'Get better care', 'Arrive at the right time and reduce unnecessary waiting.'],
          ].map(([number, title, body], index) => (
            <div className="step-card" key={number}>
              <div className="step-number">{number}</div>
              <div className="step-icon">{[<Users />, <CalendarDays />, <MonitorPlay />, <CheckCircle2 />][index]}</div>
              <h3>{title}</h3><p>{body}</p>
              {index < 3 && <ChevronRight className="step-arrow" size={22} />}
            </div>
          ))}
        </div>
        <div className="metric-band">
          <div><b>50+</b><span>Medical centers</span></div>
          <div><b>25,000+</b><span>Patients served</span></div>
          <div><b>40%</b><span>Less waiting time</span></div>
          <div><b>30%</b><span>Better doctor utilization</span></div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="marketing-section feature-detail-section">
        <div className="section-heading">
          <div className="eyebrow centered">Built around the real workflow</div>
          <h2>Everything your healthcare journey <span>needs.</span></h2>
          <p>Purpose-built tools connect patients and medical teams without adding unnecessary complexity.</p>
        </div>
        <div className="feature-detail-grid">
          <article><CalendarDays size={24} /><h3>Appointments</h3><p>Book, reschedule and cancel appointments while giving clinics a clear daily schedule.</p></article>
          <article><Users size={24} /><h3>Live Queue</h3><p>Digital tokens, walk-ins, appointments, queue position and estimated waiting time.</p></article>
          <article><MessageSquare size={24} /><h3>Patient Communication</h3><p>Keep patients informed with appointment, queue and reminder notifications.</p></article>
          <article><BarChart3 size={24} /><h3>Clinic Insights</h3><p>Understand patient volume, no-shows, waiting time, revenue and doctor utilization.</p></article>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="stories" className="marketing-section stories-section">
        <div className="section-heading">
          <div className="eyebrow centered">Testimonials</div>
          <h2>What our users say</h2>
          <p>Designed around patients and healthcare teams who want a calmer experience.</p>
        </div>
        <div className="stories-grid">
          {[
            ['I can book my appointment and check the queue from home. No more long waits at the clinic.', 'Tharushi Silva', 'Patient'],
            ['MediQueue gives our team a much clearer view of appointments, queues and the day ahead.', 'Dr. Nimal Perera', 'Medical Center'],
            ['Simple, effective, and exactly what a small clinic needs to keep the daily workflow organized.', 'Kasun Fernando', 'Clinic Owner'],
          ].map(([quote, name, role]) => (
            <article className="story-card" key={name}>
              <div className="quote-mark">“</div>
              <p>{quote}</p>
              <div className="story-stars"><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /></div>
              <div className="story-person"><div className="person-avatar">{name.split(' ').map(part => part[0]).join('').slice(0, 2)}</div><span><b>{name}</b><small>{role}</small></span></div>
            </article>
          ))}
        </div>
      </section>

      {/* CONTACT / CTA */}
      <section id="contact" className="marketing-cta">
        <div>
          <div className="eyebrow light">A better way to care is here</div>
          <h2>Join the future of<br />healthcare today.</h2>
          <p>Whether you are a patient or a medical center, MediQueue helps you save time, reduce waiting, and make every visit better.</p>
          <div className="marketing-actions">
            <Link to="/register" className="marketing-light-button">Get started now <ArrowRight size={15} /></Link>
            <a href="mailto:hello@mediqueue.io" className="marketing-outline-button">Talk to our team</a>
          </div>
        </div>
        <div className="cta-illustration"><HeartPulse size={108} strokeWidth={1} /><Activity size={52} /></div>
      </section>

      <section className="contact-strip">
        <div><PhoneCall size={18} /><span><b>Need help?</b><small>Talk to our team</small></span></div>
        <div><Mail size={18} /><span><b>hello@mediqueue.io</b><small>Email support</small></span></div>
        <div><MapPin size={18} /><span><b>Sri Lanka</b><small>Built for local healthcare</small></span></div>
      </section>

      {/* FOOTER */}
      <footer className="marketing-footer">
        <div className="footer-brand">
          <Link to="/" className="marketing-brand" onClick={goHome} style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <img src="/logo.png" alt="MediQueue" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>Medi<span>Queue</span></span>
          </Link>
          <p>A modern healthcare platform connecting patients and medical teams through appointments and live queues.</p>
          <span className="footer-status"><i /> Healthcare workflow, thoughtfully connected</span>
        </div>
        <div>
          <b>Explore</b>
          <button type="button" onClick={() => navTo('patients')}>For patients</button>
          <button type="button" onClick={() => navTo('clinics')}>For medical centers</button>
          <button type="button" onClick={() => navTo('doctors')}>For doctors</button>
          <button type="button" onClick={() => navTo('solutions')}>Features</button>
          <button type="button" onClick={() => navTo('pricing')}>Pricing</button>
        </div>
        <div>
          <b>Portals</b>
          <Link to="/login">Patient sign in</Link>
          <Link to="/register">Create patient account</Link>
          <Link to="/staff/login">Staff portal</Link>
          <Link to="/staff/register/medical-center">Register a center</Link>
          <a href="mailto:hello@mediqueue.io">Contact us</a>
        </div>
        <div>
          <b>Quick actions</b>
          <Link to="/login?new=1">Book appointment</Link>
          <Link to="/login?new=1">Join live queue</Link>
          <Link to="/staff/login">Doctor / staff login</Link>
          <p className="footer-muted">Built for calmer, kinder healthcare.</p>
          <div className="footer-social"><span>f</span><span>in</span><span>◎</span></div>
        </div>
        <div className="footer-bottom">© 2026 MediQueue. All rights reserved. <span>Privacy · Terms</span></div>
      </footer>
    </main>
  )
}
