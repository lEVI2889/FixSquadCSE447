import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className="not-found-page">
      <div className="container empty-state">
        <span className="not-found-code">404</span>
        <h1>This page needs a little fixing.</h1>
        <p>The address may have changed, or the page may no longer exist.</p>
        <Link className="button button--primary" to="/">Return home</Link>
      </div>
    </section>
  );
}

export default NotFoundPage;
