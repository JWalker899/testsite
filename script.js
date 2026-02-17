// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const navLinks = document.querySelectorAll('.nav-link');
const navToggle = document.querySelector('.nav-toggle');
const navList = document.querySelector('.nav-list');

// AR Hunt Elements
const startHuntBtn = document.getElementById('start-hunt');
const scanQrBtn = document.getElementById('scan-qr');
const useLocationBtn = document.getElementById('use-location');
const testingModeBtn = document.getElementById('testing-mode');
const progressFill = document.getElementById('progress-fill');
const progressCount = document.getElementById('progress-count');
const progressTotal = document.getElementById('progress-total');
const huntItems = document.querySelectorAll('.hunt-item');

// State Management
let huntActive = false;
let testingMode = false;
let foundLocations = new Set();
let userLocation = null;

// Scavenger Hunt Locations (for testing and location-based discovery)
const huntLocations = {
    fortress: { lat: 45.5889, lng: 25.4631, name: 'Rasnov Fortress Gate', qr: '1', fact: 'The fortress was built in 1215 by Teutonic Knights to protect against Mongol invasions.' },
    well: { lat: 45.5892, lng: 25.4635, name: 'Ancient Well', qr: '2', fact: 'This 143-meter deep well was dug by Turkish prisoners and took 17 years to complete.' },
    tower: { lat: 45.5885, lng: 25.4640, name: 'Watch Tower', qr: '3', fact: 'The watch tower provided 360-degree views to spot approaching enemies from miles away.' },
    church: { lat: 45.5890, lng: 25.4638, name: 'Old Church', qr: '4', fact: 'This Gothic church dates back to the 14th century and still holds services today.' },
    museum: { lat: 45.5850, lng: 25.4600, name: 'Village Museum', qr: '5', fact: 'The museum houses over 300 artifacts showcasing traditional Romanian village life.' },
    peak: { lat: 45.5700, lng: 25.4500, name: 'Mountain Peak', qr: '6', fact: 'At 1650m elevation, this peak offers views of the entire Barsa region on clear days.' },
    square: { lat: 45.5880, lng: 25.4620, name: 'Town Square', qr: '7', fact: 'The town square has been a gathering place for markets and festivals for over 600 years.' },
    dino: { lat: 45.5895, lng: 25.4625, name: 'Dino Park Entrance', qr: '8', fact: 'Dino Park features over 100 life-size dinosaur replicas in their natural habitat settings.' }
};

// Tab Functionality
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;
        
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
    });
});

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Close mobile menu if open
            if (navList.classList.contains('active')) {
                navList.classList.remove('active');
            }
        }
    });
});

// Mobile Menu Toggle
if (navToggle) {
    navToggle.addEventListener('click', () => {
        navList.classList.toggle('active');
    });
}

// Scroll to Section Function
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Weather Widget
async function updateWeather() {
    const tempElement = document.getElementById('temp');
    // Simulated weather data (in production, use real weather API)
    const temperatures = [15, 18, 22, 25, 20, 16];
    const randomTemp = temperatures[Math.floor(Math.random() * temperatures.length)];
    tempElement.textContent = `${randomTemp}°C`;
}

updateWeather();
setInterval(updateWeather, 300000); // Update every 5 minutes

// AR Scavenger Hunt Functions
startHuntBtn.addEventListener('click', () => {
    if (!huntActive) {
        huntActive = true;
        startHuntBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Hunt';
        startHuntBtn.classList.add('active-hunt');
        showNotification('Scavenger hunt started! Find all 8 locations.', 'success');
        
        // Enable other buttons
        scanQrBtn.disabled = false;
        useLocationBtn.disabled = false;
    } else {
        huntActive = false;
        startHuntBtn.innerHTML = '<i class="fas fa-play"></i> Start Hunt';
        startHuntBtn.classList.remove('active-hunt');
        showNotification('Scavenger hunt stopped.', 'info');
    }
});

scanQrBtn.addEventListener('click', () => {
    if (!huntActive) {
        showNotification('Please start the hunt first!', 'warning');
        return;
    }
    openModal('qr-modal');
    startQRScanner();
});

useLocationBtn.addEventListener('click', () => {
    if (!huntActive) {
        showNotification('Please start the hunt first!', 'warning');
        return;
    }
    
    if ('geolocation' in navigator) {
        showNotification('Getting your location...', 'info');
        navigator.geolocation.getCurrentPosition(
            position => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                checkNearbyLocations();
            },
            error => {
                showNotification('Could not get your location. Please enable location services.', 'error');
            }
        );
    } else {
        showNotification('Geolocation is not supported by your browser.', 'error');
    }
});

testingModeBtn.addEventListener('click', () => {
    testingMode = !testingMode;
    if (testingMode) {
        testingModeBtn.classList.add('testing-active');
        showNotification('Testing mode enabled! Click on any location to mark it as found.', 'info');
        
        // Add click handlers to hunt items in testing mode
        huntItems.forEach(item => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', handleTestingModeClick);
        });
    } else {
        testingModeBtn.classList.remove('testing-active');
        showNotification('Testing mode disabled.', 'info');
        
        // Remove click handlers
        huntItems.forEach(item => {
            item.style.cursor = '';
            item.removeEventListener('click', handleTestingModeClick);
        });
    }
});

function handleTestingModeClick(e) {
    if (testingMode && huntActive) {
        const locationKey = this.dataset.location;
        if (!foundLocations.has(locationKey)) {
            discoverLocation(locationKey);
        }
    }
}

// QR Code mapping function
function getLocationKeyFromQR(qrData) {
    const qrMap = {
        '1': 'fortress',
        '2': 'well',
        '3': 'tower',
        '4': 'church',
        '5': 'museum',
        '6': 'peak',
        '7': 'square',
        '8': 'dino'
    };
    return qrMap[qrData];
}

// Variable to store video stream for cleanup
let videoStream = null;
let scanningActive = false;

function startQRScanner() {
    const video = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');
    const canvasContext = canvas.getContext('2d');
    
    scanningActive = true;
    
    // Check if browser supports getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                videoStream = stream;
                video.srcObject = stream;
                video.play();
                
                // Start scanning for QR codes
                requestAnimationFrame(scanQRCode);
            })
            .catch(err => {
                console.error('Error accessing camera:', err);
                showNotification('Could not access camera. Testing mode allows manual selection.', 'warning');
                
                // In testing mode or if camera fails, show QR code options
                showQRCodeOptions();
            });
    } else {
        showQRCodeOptions();
    }
    
    function scanQRCode() {
        if (!scanningActive) {
            return;
        }
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Set canvas size to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Draw video frame to canvas
            canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Get image data from canvas
            const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
            
            // Scan for QR code using jsQR
            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                
                if (code) {
                    // QR code detected
                    const qrData = code.data;
                    const locationKey = getLocationKeyFromQR(qrData);
                    
                    if (locationKey) {
                        // Valid QR code found
                        if (!foundLocations.has(locationKey)) {
                            scanningActive = false;
                            stopVideoStream();
                            discoverLocation(locationKey);
                            closeModal('qr-modal');
                        } else {
                            showNotification('You already found this location!', 'info');
                        }
                    } else {
                        // Invalid QR code (readable but not 1-8)
                        showNotification('This QR code is not part of the scavenger hunt. Please scan a code numbered 1-8.', 'warning');
                        // Continue scanning
                        requestAnimationFrame(scanQRCode);
                    }
                } else {
                    // No QR code detected, continue scanning
                    requestAnimationFrame(scanQRCode);
                }
            } else {
                // jsQR not loaded, continue scanning
                requestAnimationFrame(scanQRCode);
            }
        } else {
            // Video not ready, continue scanning
            requestAnimationFrame(scanQRCode);
        }
    }
}

function stopVideoStream() {
    scanningActive = false;
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

function showQRCodeOptions() {
    const qrScanner = document.getElementById('qr-scanner');
    qrScanner.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <h4>Select a QR Code to Scan:</h4>
            <div style="display: grid; gap: 1rem; margin-top: 1rem;">
                ${Object.entries(huntLocations).map(([key, loc]) => `
                    <button class="card-button" onclick="simulateQRScan('${key}')">${loc.name}</button>
                `).join('')}
            </div>
        </div>
    `;
}

function simulateQRScan(locationKey) {
    if (huntLocations[locationKey] && !foundLocations.has(locationKey)) {
        discoverLocation(locationKey);
        closeModal('qr-modal');
    } else if (foundLocations.has(locationKey)) {
        showNotification('You already found this location!', 'info');
    }
}

function checkNearbyLocations() {
    if (!userLocation) return;
    
    let foundNearby = false;
    
    Object.entries(huntLocations).forEach(([key, location]) => {
        if (!foundLocations.has(key)) {
            const distance = calculateDistance(
                userLocation.lat, userLocation.lng,
                location.lat, location.lng
            );
            
            // Within 100 meters (or 50km in testing mode for easier testing)
            const threshold = testingMode ? 50000 : 100;
            
            if (distance < threshold) {
                discoverLocation(key);
                foundNearby = true;
            }
        }
    });
    
    if (!foundNearby) {
        showNotification('No locations nearby. Keep exploring!', 'info');
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function discoverLocation(locationKey) {
    foundLocations.add(locationKey);
    
    // Update UI
    const huntItem = document.querySelector(`.hunt-item[data-location="${locationKey}"]`);
    if (huntItem) {
        huntItem.classList.add('found');
        huntItem.querySelector('i').className = 'fas fa-check-circle';
    }
    
    // Update progress
    updateProgress();
    
    // Show discovery modal
    const location = huntLocations[locationKey];
    document.getElementById('discovery-title').textContent = `You found ${location.name}!`;
    document.getElementById('discovery-message').textContent = 'Great job exploring Rasnov!';
    document.getElementById('discovery-fact').innerHTML = `<strong>Fun Fact:</strong> ${location.fact}`;
    openModal('discovery-modal');
    
    // Check if hunt is complete
    if (foundLocations.size === Object.keys(huntLocations).length) {
        setTimeout(() => {
            showNotification('🎉 Congratulations! You completed the scavenger hunt!', 'success');
            huntActive = false;
            startHuntBtn.innerHTML = '<i class="fas fa-trophy"></i> Completed!';
            startHuntBtn.classList.remove('active-hunt');
            startHuntBtn.classList.add('hunt-complete');
        }, 2000);
    }
}

function updateProgress() {
    const total = Object.keys(huntLocations).length;
    const found = foundLocations.size;
    const percentage = (found / total) * 100;
    
    progressFill.style.width = `${percentage}%`;
    progressCount.textContent = found;
    progressTotal.textContent = total;
}

// Modal Functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        
        // Stop video if QR modal
        if (modalId === 'qr-modal') {
            stopVideoStream();
            const video = document.getElementById('qr-video');
            if (video.srcObject) {
                video.srcObject = null;
            }
        }
    }
}

// Close modals on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal.id);
        }
    });
});

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getIconForType(type)}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${getColorForType(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 3000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getIconForType(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function getColorForType(type) {
    const colors = {
        success: '#4caf50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196f3'
    };
    return colors[type] || '#2196f3';
}

// Add notification animations to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Location/Restaurant/Accommodation Details Functions
function showLocationDetails(locationId) {
    const details = {
        fortress: {
            title: 'Rasnov Fortress',
            description: 'Built in the 13th century by Teutonic Knights, Rasnov Fortress is a stunning example of medieval defensive architecture. The fortress sits atop a rocky hilltop and offers breathtaking panoramic views of the surrounding Carpathian Mountains and Barsa Valley.',
            hours: 'Daily: 9:00 AM - 6:00 PM (Summer), 9:00 AM - 5:00 PM (Winter)',
            price: 'Adults: 20 RON, Children: 10 RON, Students: 15 RON',
            tips: 'Wear comfortable shoes for climbing. Visit early morning for best photos. Allow 2-3 hours for full exploration.'
        },
        dinoparc: {
            title: 'Dino Parc',
            description: 'The largest dinosaur park in Southeast Europe featuring over 100 life-size animatronic dinosaurs. An educational and entertaining experience for the whole family with interactive exhibits and fossil displays.',
            hours: 'Daily: 10:00 AM - 7:00 PM (April-October)',
            price: 'Adults: 40 RON, Children (3-14): 30 RON, Family pass: 120 RON',
            tips: 'Perfect for families with children. Best visited in good weather. Combined tickets with fortress available.'
        },
        peak: {
            title: 'Piatra Mica Peak',
            description: 'A stunning mountain peak accessible by cable car or hiking trail. The peak offers spectacular 360-degree views of the Carpathian Mountains, Bucegi Plateau, and surrounding valleys.',
            hours: 'Cable car: 9:00 AM - 5:00 PM (Weather dependent)',
            price: 'Cable car round trip: 30 RON, Hiking: Free',
            tips: 'Check weather before going. Bring warm layers as it can be windy. Hiking takes 3-4 hours up.'
        },
        museum: {
            title: 'Village Museum',
            description: 'An authentic collection of traditional Romanian rural houses, tools, and artifacts. Learn about the rich cultural heritage and daily life of Transylvanian villages through the centuries.',
            hours: 'Tuesday-Sunday: 10:00 AM - 5:00 PM (Closed Mondays)',
            price: 'Adults: 10 RON, Children: 5 RON, Guided tours: +15 RON',
            tips: 'Guided tours available in English. Photography allowed. Visit local craft demonstrations on weekends.'
        }
    };
    
    const detail = details[locationId];
    if (detail) {
        document.getElementById('details-title').textContent = detail.title;
        document.getElementById('details-content').innerHTML = `
            <p><strong>About:</strong> ${detail.description}</p>
            <p><strong>Hours:</strong> ${detail.hours}</p>
            <p><strong>Price:</strong> ${detail.price}</p>
            <p><strong>Tips:</strong> ${detail.tips}</p>
        `;
        openModal('details-modal');
    }
}

function showRestaurantDetails(restaurantId) {
    const details = {
        cetate: {
            title: 'Cetate Restaurant',
            menu: 'Sarmale (stuffed cabbage rolls), Mici (grilled meat rolls), Polenta with cheese and sour cream, Traditional soups',
            hours: '11:00 AM - 11:00 PM',
            notes: 'Reservations recommended for groups.'
        },
        ceaun: {
            title: 'La Ceaun',
            menu: 'Ciorbă (sour soup), Grilled trout, Pork steak with mushrooms, Homemade desserts',
            hours: '12:00 PM - 10:00 PM',
            notes: 'Cozy atmosphere with fireplace.'
        },
        pizzeria: {
            title: 'Pizzeria Castello',
            menu: 'Wood-fired pizzas, Fresh pasta, Romanian-Italian fusion dishes, Tiramisu',
            hours: '11:00 AM - 11:00 PM',
            notes: 'Delivery available.'
        },
        cafe: {
            title: 'Cafe Central',
            menu: 'Specialty coffee, Fresh pastries, Breakfast menu, Sandwiches and salads',
            hours: '7:00 AM - 8:00 PM',
            notes: 'Free WiFi available.'
        }
    };
    
    const detail = details[restaurantId];
    if (detail) {
        document.getElementById('details-title').textContent = detail.title;
        document.getElementById('details-content').innerHTML = `
            <p><strong>Menu Highlights:</strong> ${detail.menu}</p>
            <p><strong>Hours:</strong> ${detail.hours}</p>
            <p><strong>Note:</strong> ${detail.notes}</p>
        `;
        openModal('details-modal');
    }
}

function showAccommodationDetails(accommodationId) {
    const details = {
        ambient: {
            title: 'Hotel Ambient',
            description: '4-star hotel with spa, indoor pool, restaurant, and mountain-view rooms.',
            amenities: 'Free WiFi, parking, breakfast included',
            price: 'From €80/night',
            contact: '+40 268 234 567'
        },
        belvedere: {
            title: 'Pension Belvedere',
            description: 'Family-run guesthouse with traditional rooms and homemade breakfast.',
            amenities: 'Free WiFi, parking, garden',
            price: 'From €40/night',
            contact: '+40 268 234 568'
        },
        petre: {
            title: 'Casa Petre',
            description: 'Fully equipped apartments in old town. Perfect for families or longer stays.',
            amenities: 'Kitchen, WiFi, parking',
            price: 'From €50/night',
            contact: '+40 268 234 569'
        },
        hostel: {
            title: 'Mountain Hostel',
            description: 'Budget-friendly with dorms and private rooms.',
            amenities: 'Shared kitchen, common area, organized trips',
            price: 'From €15/night',
            contact: '+40 268 234 570'
        }
    };
    
    const detail = details[accommodationId];
    if (detail) {
        document.getElementById('details-title').textContent = detail.title;
        document.getElementById('details-content').innerHTML = `
            <p><strong>Description:</strong> ${detail.description}</p>
            <p><strong>Amenities:</strong> ${detail.amenities}</p>
            <p><strong>Price:</strong> ${detail.price}</p>
            <p><strong>Book:</strong> ${detail.contact}</p>
        `;
        openModal('details-modal');
    }
}

// Map Loading Function
function loadMap() {
    const mapDiv = document.getElementById('interactive-map');
    mapDiv.innerHTML = `
        <div style="width: 100%; height: 100%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 2rem;">
            <i class="fas fa-map-marked-alt" style="font-size: 4rem; color: #2c5f8d; margin-bottom: 1rem;"></i>
            <h3 style="color: #2c5f8d; margin-bottom: 1rem;">Interactive Map</h3>
            <p style="color: #666; text-align: center;">Showing all locations in Rasnov</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 2rem; width: 100%;">
                <div style="background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <strong style="color: #2c5f8d;">📍 Rasnov Fortress</strong><br>
                    <small>Main attraction - Historic site</small>
                </div>
                <div style="background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <strong style="color: #e8734e;">🍽️ Cetate Restaurant</strong><br>
                    <small>Traditional Romanian cuisine</small>
                </div>
                <div style="background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <strong style="color: #4caf50;">🏨 Hotel Ambient</strong><br>
                    <small>4-star accommodation</small>
                </div>
            </div>
            <p style="margin-top: 2rem; color: #888; font-size: 0.9rem;">
                <i class="fas fa-info-circle"></i> In production, this would display a full interactive map with Google Maps or OpenStreetMap
            </p>
        </div>
    `;
    mapDiv.classList.add('loaded');
}

// Language Toggle (Basic implementation)
const langToggle = document.querySelector('.lang-toggle');
if (langToggle) {
    langToggle.addEventListener('click', () => {
        const currentLang = langToggle.textContent.trim();
        if (currentLang.includes('EN')) {
            langToggle.innerHTML = '<i class="fas fa-globe"></i> RO';
            showNotification('Language changed to Romanian (Demo)', 'info');
        } else {
            langToggle.innerHTML = '<i class="fas fa-globe"></i> EN';
            showNotification('Language changed to English', 'info');
        }
    });
}

// Initialize progress display
updateProgress();

// Initialize button states
scanQrBtn.disabled = true;
useLocationBtn.disabled = true;

// Add smooth scroll behavior
document.documentElement.style.scrollBehavior = 'smooth';

console.log('Discover Rasnov - Tourist Website Initialized');
console.log('Testing mode available for AR scavenger hunt');
