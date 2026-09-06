import { Link } from 'react-router-dom';

const services = [
  { icon: '⚡', name: 'Electrical', copy: 'Safe repairs and installations' },
  { icon: '◉', name: 'Plumbing', copy: 'Leaks, fittings, and maintenance' },
  { icon: '✦', name: 'Cleaning', copy: 'A fresh start for every room' },
  { icon: '⌂', name: 'Carpentry', copy: 'Skilled fixes made to last' },
];

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-glow hero-glow--one" />
        <div className="hero-glow hero-glow--two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span /> Trusted help, right when you need it</p>
            <h1>Your home deserves a <em>reliable squad.</em></h1>
            <p className="hero-lead">
              Find skilled local professionals for repairs, improvements, and everything
              in between—without the usual uncertainty.
            </p>
            <div className="hero-actions">
              <Link className="button button--primary" to="/register">
                Find a professional <span aria-hidden="true">→</span>
              </Link>
              <a className="button button--text" href="#how-it-works">
                See how it works <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="trust-row" aria-label="FixSquad benefits">
              <span>✓ Verified providers</span>
              <span>✓ Clear pricing</span>
              <span>✓ Local support</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="FixSquad service preview">
            <div className="tool-orbit tool-orbit--large" />
            <div className="tool-orbit tool-orbit--small" />
            <div className="service-ticket">
              <div className="ticket-top">
                <span className="ticket-icon">⚡</span>
                <span className="status-pill"><i /> Available today</span>
              </div>
              <p>Electrical repair</p>
              <h2>Switch & socket repair</h2>
              <div className="provider-line">
                <span className="avatar">AR</span>
                <span><strong>Arif Rahman</strong><small>★ 4.9 · 126 jobs</small></span>
              </div>
              <div className="ticket-bottom">
                <span><small>Starts from</small><strong>৳800</strong></span>
                <span className="mini-button">View profile</span>
              </div>
            </div>
            <div className="floating-note floating-note--top">✓ Background checked</div>
            <div className="floating-note floating-note--bottom">★ 4.8 average rating</div>
          </div>
        </div>
      </section>

      <section className="services-section" aria-labelledby="services-title">
        <div className="container">
          <p className="eyebrow"><span /> Popular services</p>
          <div className="section-heading">
            <h2 id="services-title">The right expert for every task.</h2>
            <p>Start with one of our most requested household services.</p>
          </div>
          <div className="service-grid">
            {services.map((service) => (
              <article className="service-card" key={service.name}>
                <span className="service-card__icon">{service.icon}</span>
                <h3>{service.name}</h3>
                <p>{service.copy}</p>
                <span className="service-card__arrow" aria-hidden="true">↗</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="process-section" id="how-it-works" aria-labelledby="process-title">
        <div className="container process-grid">
          <div>
            <p className="eyebrow eyebrow--light"><span /> Simple by design</p>
            <h2 id="process-title">From problem to solved in three clear steps.</h2>
          </div>
          <ol className="process-list">
            <li><span>01</span><div><h3>Tell us what you need</h3><p>Choose a service and share the details.</p></div></li>
            <li><span>02</span><div><h3>Choose your professional</h3><p>Compare profiles, services, prices, and reviews.</p></div></li>
            <li><span>03</span><div><h3>Get it handled</h3><p>Book confidently and track your request.</p></div></li>
          </ol>
        </div>
      </section>
    </>
  );
}

export default HomePage;
