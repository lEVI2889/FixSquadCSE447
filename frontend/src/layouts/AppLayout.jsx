import { Outlet } from 'react-router-dom';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';

function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default AppLayout;
