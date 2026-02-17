/**
 * Data Loader for Rasnov Tourist Website
 * 
 * This module loads places data from JSON and dynamically generates
 * location cards for the three main tabs (Locations, Restaurants, Accommodations).
 * 
 * Features:
 * - Loads data from places-data.json with fallback to sample data
 * - Dynamically generates cards with same structure as original HTML
 * - Handles missing data gracefully
 * - Maintains existing modal and interaction functionality
 * - Adds loading states and error handling
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    DATA_URL: './data/places-data.json',
    FALLBACK_DATA_URL: './data/sample-places-data.json',
    LOADING_DELAY: 300, // Minimum loading time for smooth UX
  };

  // State
  let placesData = null;

  /**
   * Initialize the data loader
   */
  async function init() {
    console.log('🔄 Initializing data loader...');
    await loadData();
    if (placesData) {
      renderAllCards();
      updateLastUpdatedTime();
      console.log('✅ Data loader initialized successfully');
    }
  }

  /**
   * Load places data from JSON file
   */
  async function loadData() {
    try {
      showLoading();
      
      // Try to load main data file
      const response = await fetch(CONFIG.DATA_URL);
      
      if (response.ok) {
        placesData = await response.json();
        console.log('✅ Loaded data from places-data.json');
      } else {
        throw new Error('Main data file not found');
      }
    } catch (error) {
      console.warn('⚠️  Could not load main data, trying fallback...', error.message);
      
      // Try fallback data
      try {
        const response = await fetch(CONFIG.FALLBACK_DATA_URL);
        if (response.ok) {
          placesData = await response.json();
          console.log('✅ Loaded fallback sample data');
          showNotification('Using sample data. Run "npm run fetch-data" to get real data.', 'info');
        } else {
          throw new Error('Fallback data not found');
        }
      } catch (fallbackError) {
        console.error('❌ Could not load any data:', fallbackError);
        showNotification('Failed to load location data. Please refresh the page.', 'error');
        hideLoading();
        return;
      }
    }

    // Add minimum loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, CONFIG.LOADING_DELAY));
    hideLoading();
  }

  /**
   * Show loading state
   */
  function showLoading() {
    const containers = ['locations', 'restaurants', 'accommodations'];
    containers.forEach(containerId => {
      const container = document.getElementById(containerId);
      if (container) {
        const grid = container.querySelector('.card-grid');
        if (grid) {
          grid.innerHTML = `
            <div class="loading-state">
              <div class="loading-spinner"></div>
              <p>Loading amazing places...</p>
            </div>
          `;
        }
      }
    });
  }

  /**
   * Hide loading state
   */
  function hideLoading() {
    const loadingStates = document.querySelectorAll('.loading-state');
    loadingStates.forEach(state => state.remove());
  }

  /**
   * Render all cards in all tabs
   */
  function renderAllCards() {
    if (!placesData) return;

    renderCards('locations', placesData.locations);
    renderCards('restaurants', placesData.restaurants);
    renderCards('accommodations', placesData.accommodations);
  }

  /**
   * Render cards for a specific category
   */
  function renderCards(category, places) {
    const container = document.getElementById(category);
    if (!container) {
      console.error(`Container for ${category} not found`);
      return;
    }

    const grid = container.querySelector('.card-grid');
    if (!grid) {
      console.error(`Card grid in ${category} not found`);
      return;
    }

    // Clear existing cards
    grid.innerHTML = '';

    // Generate cards
    places.forEach((place, index) => {
      const card = createCard(place, category);
      grid.appendChild(card);
    });

    console.log(`✅ Rendered ${places.length} cards in ${category}`);
  }

  /**
   * Create a single card element
   */
  function createCard(place, category) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-place-id', place.id);

    // Get primary photo or use placeholder
    const photoUrl = place.photos && place.photos.length > 0 
      ? place.photos[0].url 
      : 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';

    // Create card HTML
    card.innerHTML = `
      <div class="card-image" style="background-image: url('${photoUrl}')">
        ${place.rating ? `
          <div class="card-badge">
            <i class="fas fa-star"></i> ${place.rating.toFixed(1)}
          </div>
        ` : ''}
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(place.name)}</h3>
        <p class="card-description">${getDescription(place)}</p>
        <div class="card-meta">
          ${getMetaInfo(place, category)}
        </div>
        <button class="card-button" onclick="showDynamicDetails('${place.id}', '${category}')">
          Learn More
        </button>
      </div>
    `;

    return card;
  }

  /**
   * Get description for a place
   */
  function getDescription(place) {
    if (place.description) {
      return escapeHtml(place.description);
    }
    
    // Generate description from address and rating
    let desc = place.address || 'A wonderful place to visit in Rasnov';
    if (place.rating && place.userRatingsTotal > 0) {
      desc += `. Rated ${place.rating}/5 by ${place.userRatingsTotal} visitors.`;
    }
    return escapeHtml(desc);
  }

  /**
   * Get meta information for a place
   */
  function getMetaInfo(place, category) {
    const meta = [];

    // Opening hours
    if (place.openingHours) {
      const status = place.openingHours.openNow ? 'Open now' : 'Closed';
      const icon = place.openingHours.openNow ? 'clock' : 'clock';
      meta.push(`<span><i class="fas fa-${icon}"></i> ${status}</span>`);
    }

    // Price level
    if (place.priceLevel) {
      const price = '💰'.repeat(place.priceLevel);
      meta.push(`<span>${price}</span>`);
    }

    // Rating and reviews
    if (place.rating && place.userRatingsTotal > 0) {
      meta.push(`<span><i class="fas fa-users"></i> ${place.userRatingsTotal} reviews</span>`);
    }

    // Phone
    if (place.phone) {
      meta.push(`<span><i class="fas fa-phone"></i> ${escapeHtml(place.phone)}</span>`);
    }

    return meta.join('');
  }

  /**
   * Show detailed information modal for a place
   */
  window.showDynamicDetails = function(placeId, category) {
    if (!placesData) return;

    // Find the place in the data
    let place = null;
    if (category === 'locations') {
      place = placesData.locations.find(p => p.id === placeId);
    } else if (category === 'restaurants') {
      place = placesData.restaurants.find(p => p.id === placeId);
    } else if (category === 'accommodations') {
      place = placesData.accommodations.find(p => p.id === placeId);
    }

    if (!place) {
      console.error('Place not found:', placeId);
      return;
    }

    // Create and show modal
    showDetailsModal(place, category);
  };

  /**
   * Show details modal for a place
   */
  function showDetailsModal(place, category) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('dynamic-details-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dynamic-details-modal';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }

    // Get primary photo
    const photoUrl = place.photos && place.photos.length > 0 
      ? place.photos[0].url 
      : 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';

    // Build modal content
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" onclick="closeModal('dynamic-details-modal')">
          <i class="fas fa-times"></i>
        </button>
        <div class="modal-header">
          <img src="${photoUrl}" alt="${escapeHtml(place.name)}" class="modal-image">
          <div class="modal-title-section">
            <h2>${escapeHtml(place.name)}</h2>
            ${place.rating ? `
              <div class="modal-rating">
                <i class="fas fa-star"></i>
                <span>${place.rating.toFixed(1)}/5</span>
                <span class="rating-count">(${place.userRatingsTotal} reviews)</span>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="modal-body">
          ${place.address ? `
            <div class="modal-info-item">
              <i class="fas fa-map-marker-alt"></i>
              <div>
                <strong>Address</strong>
                <p>${escapeHtml(place.address)}</p>
              </div>
            </div>
          ` : ''}
          
          ${place.phone ? `
            <div class="modal-info-item">
              <i class="fas fa-phone"></i>
              <div>
                <strong>Phone</strong>
                <p><a href="tel:${place.phone}">${escapeHtml(place.phone)}</a></p>
              </div>
            </div>
          ` : ''}
          
          ${place.website ? `
            <div class="modal-info-item">
              <i class="fas fa-globe"></i>
              <div>
                <strong>Website</strong>
                <p><a href="${place.website}" target="_blank" rel="noopener noreferrer">Visit website</a></p>
              </div>
            </div>
          ` : ''}
          
          ${place.openingHours && place.openingHours.weekdayText ? `
            <div class="modal-info-item">
              <i class="fas fa-clock"></i>
              <div>
                <strong>Opening Hours</strong>
                <ul class="opening-hours-list">
                  ${place.openingHours.weekdayText.map(day => `<li>${escapeHtml(day)}</li>`).join('')}
                </ul>
              </div>
            </div>
          ` : ''}
          
          ${place.priceLevel ? `
            <div class="modal-info-item">
              <i class="fas fa-dollar-sign"></i>
              <div>
                <strong>Price Level</strong>
                <p>${'💰'.repeat(place.priceLevel)} (${getPriceLevelText(place.priceLevel)})</p>
              </div>
            </div>
          ` : ''}
          
          <div class="modal-actions">
            <button class="modal-button" onclick="showOnMap(${place.coordinates.lat}, ${place.coordinates.lng}, '${escapeHtml(place.name)}')">
              <i class="fas fa-map"></i> View on Map
            </button>
            ${place.phone ? `
              <button class="modal-button" onclick="window.location.href='tel:${place.phone}'">
                <i class="fas fa-phone"></i> Call Now
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Show modal
    modal.classList.add('active');
  }

  /**
   * Get price level text
   */
  function getPriceLevelText(level) {
    const levels = {
      1: 'Inexpensive',
      2: 'Moderate',
      3: 'Expensive',
      4: 'Very Expensive'
    };
    return levels[level] || 'Unknown';
  }

  /**
   * Show place on map
   */
  window.showOnMap = function(lat, lng, name) {
    // Close modal
    closeModal('dynamic-details-modal');
    
    // Scroll to map
    const mapSection = document.getElementById('map');
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth' });
      
      // If map is loaded, pan to location
      setTimeout(() => {
        if (window.map) {
          window.map.setView([lat, lng], 15);
          
          // Open popup for this location
          window.map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
              const popup = layer.getPopup();
              if (popup && popup.getContent().includes(name)) {
                layer.openPopup();
              }
            }
          });
        }
      }, 500);
    }
  };

  /**
   * Update last updated timestamp
   */
  function updateLastUpdatedTime() {
    if (!placesData || !placesData.lastUpdated) return;

    const date = new Date(placesData.lastUpdated);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Find or create last updated indicator
    let indicator = document.getElementById('last-updated-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'last-updated-indicator';
      indicator.className = 'last-updated-indicator';
      
      const mainContent = document.querySelector('.main-content .container');
      if (mainContent) {
        mainContent.insertBefore(indicator, mainContent.firstChild);
      }
    }

    indicator.innerHTML = `
      <i class="fas fa-info-circle"></i>
      <span>Data last updated: ${formatted}</span>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show notification (uses existing notification system from script.js)
   */
  function showNotification(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Get places data (for external access)
   */
  window.getPlacesData = function() {
    return placesData;
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
