import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchServices, fetchCategories } from '../services/api';
import BookingModal from '../components/BookingModal';
import { useAuth } from '../context/useAuth';

function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // URL Query Parameters
  const initialKeyword = searchParams.get('keyword') || '';
  const initialCategory = searchParams.get('category_id') || 'all';

  const [keyword, setKeyword] = useState(initialKeyword);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected service for booking modal
  const [activeBookingService, setActiveBookingService] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Load categories once
  useEffect(() => {
    fetchCategories()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      })
      .catch((err) => console.error('Error loading categories:', err));
  }, []);

  // Fetch filtered services
  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (keyword.trim()) params.keyword = keyword.trim();
      if (selectedCategory && selectedCategory !== 'all') {
        params.category_id = selectedCategory;
      }
      if (minPrice && !isNaN(minPrice)) params.min_price = minPrice;
      if (maxPrice && !isNaN(maxPrice)) params.max_price = maxPrice;
      if (sortBy) params.sort = sortBy;

      const res = await searchServices(params);
      if (res.success && Array.isArray(res.data)) {
        setServices(res.data);
      } else {
        setServices([]);
      }
    } catch (err) {
      console.error('Error fetching search results:', err);
      setError('Unable to load services. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedCategory, minPrice, maxPrice, sortBy]);

  // Trigger search on filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadServices();
    }, 200); // 200ms debounce for real-time responsiveness

    return () => clearTimeout(timer);
  }, [loadServices]);

  // Sync state to URL params
  useEffect(() => {
    const nextParams = {};
    if (keyword.trim()) nextParams.keyword = keyword.trim();
    if (selectedCategory && selectedCategory !== 'all') nextParams.category_id = selectedCategory;
    setSearchParams(nextParams, { replace: true });
  }, [keyword, selectedCategory, setSearchParams]);

  const handleClearFilters = () => {
    setKeyword('');
    setSelectedCategory('all');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
  };

  const handleBookNow = (service) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setActiveBookingService(service);
  };

  const handleBookingSuccess = (booking) => {
    setToastMessage(`Booking #${booking.id} placed successfully!`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="services-page">
      {/* Search Header Banner */}
      <section className="services-header-hero">
        <div className="container">
          <div className="services-hero-content">
            <span className="eyebrow eyebrow--light">
              <span /> Dynamic Service Catalog & Search
            </span>
            <h1>Explore Verified Squad Services</h1>
            <p>
              Find trusted plumbers, electricians, cleaners, and technicians. Compare prices,
              check real-time availability, and book instantly.
            </p>

            {/* Main Interactive Search Input */}
            <div className="search-bar-wrap">
              <div className="search-input-box">
                <span className="search-icon" aria-hidden="true">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by service name, task, or keyword (e.g. 'pipe leak', 'fan', 'deep clean')..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  aria-label="Search services"
                />
                {keyword && (
                  <button
                    className="search-clear-btn"
                    type="button"
                    onClick={() => setKeyword('')}
                    aria-label="Clear search text"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Search & Results Workspace */}
      <div className="container services-workspace">
        {toastMessage && (
          <div className="toast-notification">
            <span>✓</span> {toastMessage}
          </div>
        )}

        {/* Category Filter Pills */}
        <div className="category-pills-bar" role="tablist" aria-label="Filter by Category">
          <button
            type="button"
            className={`cat-pill ${selectedCategory === 'all' ? 'cat-pill--active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            <span className="cat-pill__icon">✨</span>
            <span>All Services</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`cat-pill ${
                String(selectedCategory) === String(cat.id) ? 'cat-pill--active' : ''
              }`}
              onClick={() => setSelectedCategory(String(cat.id))}
            >
              <span className="cat-pill__icon">{cat.icon || '🛠'}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Filter Controls Bar (Price & Sort) */}
        <div className="filters-control-bar">
          <div className="results-count">
            Showing <strong>{services.length}</strong> {services.length === 1 ? 'service' : 'services'}
            {keyword && <span> matching "<em>{keyword}</em>"</span>}
          </div>

          <div className="filters-right-group">
            {/* Price Filter Inputs */}
            <div className="price-filter-group">
              <span className="filter-label">Price (৳):</span>
              <input
                type="number"
                placeholder="Min"
                className="price-input"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                min="0"
              />
              <span className="filter-sep">-</span>
              <input
                type="number"
                placeholder="Max"
                className="price-input"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                min="0"
              />
            </div>

            {/* Sort Selector */}
            <div className="sort-filter-group">
              <label htmlFor="service-sort" className="filter-label">Sort By:</label>
              <select
                id="service-sort"
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest Added</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating_desc">Highest Rated</option>
              </select>
            </div>

            {(keyword || selectedCategory !== 'all' || minPrice || maxPrice) && (
              <button
                type="button"
                className="clear-all-link"
                onClick={handleClearFilters}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Service Cards Grid / Content States */}
        {loading ? (
          <div className="services-loading-state">
            <div className="spinner" />
            <p>Searching FixSquad services...</p>
          </div>
        ) : error ? (
          <div className="form-alert">{error}</div>
        ) : services.length === 0 ? (
          <div className="services-empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No matching services found</h3>
            <p>We couldn't find any services matching your active search and filter criteria.</p>
            <button
              className="button button--primary"
              type="button"
              onClick={handleClearFilters}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="services-cards-grid">
            {services.map((service) => (
              <article key={service.id} className="catalog-card">
                <div className="catalog-card__header">
                  <span className="catalog-cat-badge">
                    <i>{service.category_icon || '🛠'}</i>
                    {service.category_name || 'General Service'}
                  </span>
                  <div className="catalog-rating">
                    ★ {Number(service.provider_rating || 4.8).toFixed(1)}
                    <small>({service.total_reviews || 12})</small>
                  </div>
                </div>

                <h3 className="catalog-card__title">{service.name}</h3>
                <p className="catalog-card__desc">{service.description}</p>

                <div className="catalog-provider-info">
                  <div className="provider-avatar">
                    {(service.provider_name || 'Fixer')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div className="provider-meta">
                    <span className="provider-label">Provider</span>
                    <strong className="provider-name">
                      {service.provider_name || 'Verified Professional'}
                    </strong>
                  </div>
                </div>

                <div className="catalog-card__footer">
                  <div className="catalog-price-tag">
                    <small>Fixed Base Rate</small>
                    <strong>৳{Number(service.base_price).toFixed(2)}</strong>
                  </div>
                  <button
                    className="button button--primary button--small"
                    type="button"
                    onClick={() => handleBookNow(service)}
                  >
                    Book Now <span>⚡</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {activeBookingService && (
        <BookingModal
          service={activeBookingService}
          onClose={() => setActiveBookingService(null)}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
}

export default ServicesPage;
