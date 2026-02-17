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
    fortress: { lat: 45.5889, lng: 25.4631, name: 'Rasnov Fortress Gate', qr: 'RASNOV_FORTRESS', fact: 'The fortress was built in 1215 by Teutonic Knights to protect against Mongol invasions.' },
    well: { lat: 45.5892, lng: 25.4635, name: 'Ancient Well', qr: 'RASNOV_WELL', fact: 'This 143-meter deep well was dug by Turkish prisoners and took 17 years to complete.' },
    tower: { lat: 45.5885, lng: 25.4640, name: 'Watch Tower', qr: 'RASNOV_TOWER', fact: 'The watch tower provided 360-degree views to spot approaching enemies from miles away.' },
    church: { lat: 45.5890, lng: 25.4638, name: 'Old Church', qr: 'RASNOV_CHURCH', fact: 'This Gothic church dates back to the 14th century and still holds services today.' },
    museum: { lat: 45.5850, lng: 25.4600, name: 'Village Museum', qr: 'RASNOV_MUSEUM', fact: 'The museum houses over 300 artifacts showcasing traditional Romanian village life.' },
    peak: { lat: 45.5700, lng: 25.4500, name: 'Mountain Peak', qr: 'RASNOV_PEAK', fact: 'At 1650m elevation, this peak offers views of the entire Barsa region on clear days.' },
    square: { lat: 45.5880, lng: 25.4620, name: 'Town Square', qr: 'RASNOV_SQUARE', fact: 'The town square has been a gathering place for markets and festivals for over 600 years.' },
    dino: { lat: 45.5895, lng: 25.4625, name: 'Dino Park Entrance', qr: 'RASNOV_DINO', fact: 'Dino Park features over 100 life-size dinosaur replicas in their natural habitat settings.' }
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

let qrScannerActive = false;
let qrScannerCanvas = null;
let qrScannerContext = null;

function startQRScanner() {
    const video = document.getElementById('qr-video');
    
    // Check if browser supports getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                video.srcObject = stream;
                video.play();
                qrScannerActive = true;
                
                // Create canvas for QR code detection
                if (!qrScannerCanvas) {
                    qrScannerCanvas = document.createElement('canvas');
                    qrScannerContext = qrScannerCanvas.getContext('2d');
                }
                
                // Start scanning for QR codes
                requestAnimationFrame(scanQRCode);
                
                // Simulate QR code detection in testing mode
                if (testingMode) {
                    setTimeout(() => {
                        const randomLocation = Object.keys(huntLocations)[Math.floor(Math.random() * Object.keys(huntLocations).length)];
                        simulateQRScan(randomLocation);
                    }, 2000);
                }
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
}

function scanQRCode() {
    const video = document.getElementById('qr-video');
    
    if (!qrScannerActive || !video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        if (qrScannerActive) {
            requestAnimationFrame(scanQRCode);
        }
        return;
    }
    
    // Set canvas size to match video
    qrScannerCanvas.width = video.videoWidth;
    qrScannerCanvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    qrScannerContext.drawImage(video, 0, 0, qrScannerCanvas.width, qrScannerCanvas.height);
    
    // Get image data and scan for QR code
    const imageData = qrScannerContext.getImageData(0, 0, qrScannerCanvas.width, qrScannerCanvas.height);
    
    // Use jsQR library to decode QR code (if available)
    if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        
        if (code && code.data) {
            // QR code detected! Process it
            processQRCode(code.data);
            return; // Stop scanning
        }
    }
    
    // Continue scanning
    if (qrScannerActive) {
        requestAnimationFrame(scanQRCode);
    }
}

function processQRCode(qrData) {
    // Look for matching location based on QR code data
    let foundLocationKey = null;
    
    for (const [key, location] of Object.entries(huntLocations)) {
        if (location.qr === qrData) {
            foundLocationKey = key;
            break;
        }
    }
    
    if (foundLocationKey) {
        if (!foundLocations.has(foundLocationKey)) {
            qrScannerActive = false;
            discoverLocation(foundLocationKey);
            closeModal('qr-modal');
            showNotification('QR Code scanned successfully!', 'success');
        } else {
            showNotification('You already found this location!', 'info');
        }
    } else {
        showNotification('QR code not recognized. Make sure you\'re at a scavenger hunt location.', 'warning');
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
            qrScannerActive = false;
            const video = document.getElementById('qr-video');
            if (video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
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
        },
        bran: {
            title: 'Bran Castle',
            description: 'Famous as "Dracula\'s Castle", this Gothic fortress is steeped in legend and history. The castle offers fascinating exhibits about medieval life and the region\'s royal history.',
            hours: 'Monday: 12:00 PM - 6:00 PM, Tuesday-Sunday: 9:00 AM - 6:00 PM',
            price: 'Adults: 45 RON, Students: 25 RON, Children: 10 RON',
            tips: 'Very popular - arrive early or late to avoid crowds. Allow 1.5-2 hours. Combined tickets with Peles available.'
        },
        poiana: {
            title: 'Poiana Brasov Ski Resort',
            description: 'Premier ski resort with 23km of slopes for all skill levels. In summer, offers hiking, mountain biking, and stunning alpine scenery.',
            hours: 'Ski Season: December-March, 8:00 AM - 4:00 PM. Summer activities: May-October',
            price: 'Ski pass: 150 RON/day, Equipment rental: 80 RON/day',
            tips: 'Book lessons in advance. Multiple difficulty levels available. Great apres-ski scene.'
        },
        brasov: {
            title: 'Brasov Old Town',
            description: 'Medieval city center featuring the impressive Black Church, colorful baroque buildings, and the famous Council Square. Charming cobblestone streets perfect for walking.',
            hours: 'Always accessible (individual attractions vary)',
            price: 'Free to walk around, Black Church: 10 RON',
            tips: 'Don\'t miss Council Square and Rope Street (narrowest street). Great shopping and dining options.'
        },
        peles: {
            title: 'Peles Castle',
            description: 'One of Europe\'s most beautiful castles, this Neo-Renaissance masterpiece features 160 rooms with stunning art, furniture, and architecture. Former royal summer residence.',
            hours: 'Wednesday-Sunday: 9:15 AM - 5:00 PM (Closed Monday-Tuesday)',
            price: 'Adults: 50 RON, Students: 12.5 RON. Photo permit: 35 RON',
            tips: 'Book online to skip lines. Guided tours mandatory. Photography not allowed inside without permit.'
        },
        'national-park': {
            title: 'Piatra Craiului National Park',
            description: 'Protected mountain range with dramatic limestone ridge. Home to rare wildlife including chamois, lynx, and brown bears. Pristine alpine meadows and forests.',
            hours: 'Always open (visitor center: 9:00 AM - 5:00 PM)',
            price: 'Free entry, Guided tours: 100-200 RON',
            tips: 'Stay on marked trails. Bring proper hiking gear. Best months: June-September. Bear-safe practices required.'
        },
        'bear-sanctuary': {
            title: 'Libearty Bear Sanctuary',
            description: 'Europe\'s largest brown bear sanctuary, home to over 100 rescued bears. Ethical tourism supporting bear conservation and welfare in natural forest habitat.',
            hours: 'Daily: 9:00 AM - 7:00 PM (April-October), 9:00 AM - 5:00 PM (November-March)',
            price: 'Adults: 25 RON, Children: 15 RON, Family: 60 RON',
            tips: 'Allow 1.5 hours. Bears most active in morning/evening. Support conservation by not feeding wildlife.'
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
        },
        'belvedere-terrace': {
            title: 'Belvedere Terrace',
            menu: 'International cuisine, Steaks, Seafood, Fine wines, Gourmet desserts',
            hours: '12:00 PM - 11:00 PM (Kitchen closes at 10:00 PM)',
            notes: 'Reservations essential for sunset dining. Dress code: Smart casual.'
        },
        'grill-house': {
            title: 'Grill House Rasnov',
            menu: 'Mixed grills, BBQ ribs, Chicken skewers, Fresh salads, Local wines and craft beers',
            hours: '12:00 PM - 11:00 PM',
            notes: 'Outdoor seating available. Great for groups.'
        },
        bistro: {
            title: 'Bistro Rasnoveana',
            menu: 'Daily specials, Soups, Burgers, Pasta, Homemade cakes and desserts',
            hours: '10:00 AM - 10:00 PM',
            notes: 'Budget-friendly. Quick service. Lunch specials 11:00 AM - 2:00 PM.'
        },
        vegetarian: {
            title: 'Vegetarian Haven',
            menu: 'Buddha bowls, Vegan burgers, Fresh juices, Smoothies, Plant-based desserts',
            hours: '9:00 AM - 9:00 PM',
            notes: 'All organic ingredients. Gluten-free options available.'
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
        },
        villa: {
            title: 'Villa Carpathia',
            description: 'Luxury villa with 5 bedrooms, private garden, outdoor pool, and jacuzzi.',
            amenities: 'Private pool, garden, BBQ area, full kitchen, parking',
            price: 'From €300/night (sleeps 10)',
            contact: '+40 268 234 571'
        },
        boutique: {
            title: 'Boutique Hotel Residence',
            description: 'Contemporary 4-star boutique hotel with rooftop bar and fitness center.',
            amenities: 'Rooftop bar, gym, restaurant, spa treatments, free WiFi',
            price: 'From €90/night',
            contact: '+40 268 234 572'
        },
        cabins: {
            title: 'Mountain Cabins',
            description: 'Rustic wooden cabins with modern amenities. Each with fireplace and private terrace.',
            amenities: 'Fireplace, terrace, kitchenette, WiFi',
            price: 'From €60/night (2 persons)',
            contact: '+40 268 234 573'
        },
        'casa-maria': {
            title: 'Casa Maria B&B',
            description: 'Traditional bed and breakfast run by local family. Authentic experience with homemade meals.',
            amenities: 'Breakfast included, shared lounge, garden, WiFi',
            price: 'From €35/night',
            contact: '+40 268 234 574'
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
let map = null;

function loadMap() {
    const mapDiv = document.getElementById('interactive-map');
    
    // Check if Leaflet library is available
    if (typeof L === 'undefined') {
        // Fallback for when Leaflet is not available (CDN blocked or offline)
        mapDiv.innerHTML = `
            <div id="map-fallback" style="width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 2rem; color: white; border-radius: 12px;">
                <i class="fas fa-map-marked-alt" style="font-size: 5rem; margin-bottom: 2rem; opacity: 0.9;"></i>
                <h3 style="color: white; margin-bottom: 1.5rem; font-size: 1.8rem;">Interactive Map</h3>
                <p style="color: rgba(255,255,255,0.9); text-align: center; margin-bottom: 2rem; max-width: 600px;">
                    Showing all tourist locations, restaurants, and accommodations in Rasnov
                </p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 2rem; width: 100%; max-width: 900px;">
                    <div style="background: rgba(255,255,255,0.95); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: #333;">
                        <strong style="color: #2c5f8d; font-size: 1.1rem; display: block; margin-bottom: 0.5rem;">📍 Locations</strong>
                        <small style="color: #666;">Rasnov Fortress, Dino Parc, Piatra Mica Peak, Village Museum, Bran Castle, Poiana Brasov, Brasov Old Town, Peles Castle, National Park, Bear Sanctuary</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.95); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: #333;">
                        <strong style="color: #e8734e; font-size: 1.1rem; display: block; margin-bottom: 0.5rem;">🍽️ Restaurants</strong>
                        <small style="color: #666;">Cetate Restaurant, La Ceaun, Pizzeria Castello, Cafe Central, Belvedere Terrace, Grill House, Bistro Rasnoveana, Vegetarian Haven</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.95); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: #333;">
                        <strong style="color: #4caf50; font-size: 1.1rem; display: block; margin-bottom: 0.5rem;">🏨 Accommodations</strong>
                        <small style="color: #666;">Hotel Ambient, Pension Belvedere, Casa Petre, Mountain Hostel, Villa Carpathia, Boutique Hotel Residence, Mountain Cabins, Casa Maria B&B</small>
                    </div>
                </div>
                <p style="margin-top: 2rem; color: rgba(255,255,255,0.7); font-size: 0.95rem; text-align: center;">
                    <i class="fas fa-info-circle"></i> In production, this displays a fully interactive map powered by OpenStreetMap/Leaflet
                </p>
            </div>
        `;
        mapDiv.classList.add('loaded');
        showNotification('Map loaded with all locations!', 'success');
        return;
    }
    
    // Clear placeholder content
    mapDiv.innerHTML = '<div id="map-display" style="width: 100%; height: 100%;"></div>';
    
    // Initialize Leaflet map
    window.map = L.map('map-display').setView([45.5889, 25.4631], 14);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(window.map);
    
    // Define custom icons
    const locationIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDMyIDQwIj48cGF0aCBmaWxsPSIjMmM1ZjhkIiBkPSJNMTYgMEMxMC40ODYgMCA2IDQuNDg2IDYgMTBjMCA3LjUgMTAgMTcuNSAxMCAzMCAwIDAgMTAtMjIuNSAxMC0zMCAwLTUuNTE0LTQuNDg2LTEwLTEwLTEwem0wIDE1Yy0yLjc2MSAwLTUtMi4yMzktNS01czIuMjM5LTUgNS01IDUgMi4yMzkgNSA1LTIuMjM5IDUtNSA1eiIvPjwvc3ZnPg==',
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40]
    });
    
    const restaurantIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDMyIDQwIj48cGF0aCBmaWxsPSIjZTg3MzRlIiBkPSJNMTYgMEMxMC40ODYgMCA2IDQuNDg2IDYgMTBjMCA3LjUgMTAgMTcuNSAxMCAzMCAwIDAgMTAtMjIuNSAxMC0zMCAwLTUuNTE0LTQuNDg2LTEwLTEwLTEwem0wIDE1Yy0yLjc2MSAwLTUtMi4yMzktNS01czIuMjM5LTUgNS01IDUgMi4yMzkgNSA1LTIuMjM5IDUtNSA1eiIvPjwvc3ZnPg==',
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40]
    });
    
    const accommodationIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDMyIDQwIj48cGF0aCBmaWxsPSIjNGNhZjUwIiBkPSJNMTYgMEMxMC40ODYgMCA2IDQuNDg2IDYgMTBjMCA3LjUgMTAgMTcuNSAxMCAzMCAwIDAgMTAtMjIuNSAxMC0zMCAwLTUuNTE0LTQuNDg2LTEwLTEwLTEwem0wIDE1Yy0yLjc2MSAwLTUtMi4yMzktNS01czIuMjM5LTUgNS01IDUgMi4yMzkgNSA1LTIuMjM5IDUtNSA1eiIvPjwvc3ZnPg==',
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40]
    });
    
    // Load markers from places data
    loadMapMarkers(locationIcon, restaurantIcon, accommodationIcon);
    
    mapDiv.classList.add('loaded');
    showNotification('Map loaded successfully!', 'success');
}

/**
 * Load map markers from places data
 */
async function loadMapMarkers(locationIcon, restaurantIcon, accommodationIcon) {
    // Use event-based approach to wait for data
    const placesData = await waitForPlacesData();
    
    if (!placesData) {
        console.error('❌ Could not load places data for map');
        return;
    }
    
    console.log('📍 Loading map markers from places data...');
    
    // Add locations
    if (placesData.locations) {
        placesData.locations.forEach(place => {
            addMarkerToMap(place, 'location', locationIcon);
        });
    }
    
    // Add restaurants
    if (placesData.restaurants) {
        placesData.restaurants.forEach(place => {
            addMarkerToMap(place, 'restaurant', restaurantIcon);
        });
    }
    
    // Add accommodations
    if (placesData.accommodations) {
        placesData.accommodations.forEach(place => {
            addMarkerToMap(place, 'accommodation', accommodationIcon);
        });
    }
    
    console.log('✅ Map markers loaded successfully');
}

/**
 * Wait for places data to be loaded with retry logic
 */
async function waitForPlacesData(maxAttempts = 10, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        const placesData = window.getPlacesData ? window.getPlacesData() : null;
        if (placesData) {
            return placesData;
        }
        if (i < maxAttempts - 1) {
            console.log(`⏳ Waiting for places data (attempt ${i + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return null;
}

/**
 * Add a marker to the map
 */
function addMarkerToMap(place, type, icon) {
    if (!window.map || !place.coordinates) return;
    
    const { lat, lng } = place.coordinates;
    
    // Create popup content with enhanced information
    const popupContent = `
        <div class="map-popup">
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #2c3e50;">
                ${escapeHtml(place.name)}
            </h3>
            ${place.rating ? `
                <div style="margin-bottom: 0.5rem;">
                    <span style="color: #f39c12;">⭐ ${place.rating.toFixed(1)}</span>
                    <span style="color: #666; font-size: 0.9rem;"> (${place.userRatingsTotal} reviews)</span>
                </div>
            ` : ''}
            ${place.address ? `
                <p style="margin: 0.3rem 0; font-size: 0.9rem; color: #666;">
                    📍 ${escapeHtml(place.address)}
                </p>
            ` : ''}
            ${place.phone ? `
                <p style="margin: 0.3rem 0; font-size: 0.9rem; color: #666;">
                    📞 ${escapeHtml(place.phone)}
                </p>
            ` : ''}
            ${place.openingHours ? `
                <p style="margin: 0.3rem 0; font-size: 0.9rem; color: ${place.openingHours.openNow ? '#27ae60' : '#e74c3c'};">
                    ${place.openingHours.openNow ? '✅ Open now' : '❌ Closed'}
                </p>
            ` : ''}
        </div>
    `;
    
    const marker = L.marker([lat, lng], { icon: icon })
        .addTo(window.map)
        .bindPopup(popupContent);
    
    // Add click handler to marker to show details
    marker.on('popupopen', () => {
        // Add event listener to the popup after it opens
        setTimeout(() => {
            const popup = marker.getPopup();
            const popupElement = popup.getElement();
            if (popupElement) {
                const button = document.createElement('button');
                button.textContent = 'View Details';
                button.style.cssText = `
                    margin-top: 0.8rem;
                    padding: 0.5rem 1rem;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    width: 100%;
                `;
                button.addEventListener('click', () => {
                    showDynamicDetails(place.id, type === 'location' ? 'locations' : type + 's');
                });
                const popupContent = popupElement.querySelector('.map-popup');
                if (popupContent) {
                    popupContent.appendChild(button);
                }
            }
        }, 50);
    });
}

/**
 * Helper function to escape HTML (avoid XSS)
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
