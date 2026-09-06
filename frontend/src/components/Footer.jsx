import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <Link className="brand brand--footer" to="/">
          <BrandMark />
          <span>Fix<span>Squad</span></span>
        </Link>
        <p>Reliable help for the homes and people of Bangladesh.</p>
        <p>© {new Date().getFullYear()} FixSquad</p>
      </div>
    </footer>
  );
}

export default Footer;
