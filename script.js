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
const testLocationBtn = document.getElementById('test-location');
const testingModeBtn = document.getElementById('testing-mode');
const progressFill = document.getElementById('progress-fill');
const progressCount = document.getElementById('progress-count');
const progressTotal = document.getElementById('progress-total');
const huntItems = document.querySelectorAll('.hunt-item');

// AR Modal Elements
const arModal = document.getElementById('ar-modal');
const arLoading = document.getElementById('ar-loading');
const arCloseBtn = document.getElementById('ar-close-btn');
const arSceneContainer = document.getElementById('ar-scene-container');
const arOverlayText = document.getElementById('ar-overlay-text');
const arLocationName = document.getElementById('ar-location-name');
const arLocationHint = document.getElementById('ar-location-hint');
const arTestModeIndicator = document.getElementById('ar-test-mode-indicator');
const arCaptureBtn = document.getElementById('ar-capture-btn');
const arHuntBanner = document.getElementById('ar-hunt-banner');
const arHuntText = document.getElementById('ar-hunt-text');
const arFlash = document.getElementById('ar-flash');

// State Management
let huntActive = false;
let testingMode = false;
let foundLocations = new Set();
let userLocation = null;
let arStream = null;
let currentARLocation = null;

// Three.js / AR 3D state
let arThreeRenderer = null;
let arThreeMixer = null;
let arThreeClock = null;
let arAnimationId = null;
let arBearReady = false;

// ==================== Cookie Helpers ====================
function setCookie(name, value, days = 365) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const secure = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict${secure}`;
}

function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let c of ca) {
        c = c.trim();
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length));
        }
    }
    return null;
}

// ==================== User Account & Points System ====================
let currentUser = null;
const POINTS_PER_LOCATION = 10;
const COMPLETION_BONUS = 50;

// Initialize user from localStorage or cookie or create anonymous session
function initializeUser() {
    const savedUser = localStorage.getItem('rasnov_user') || getCookie('rasnov_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
        } catch (e) {
            console.error('Failed to load user from storage:', e);
            createAnonymousUser();
        }
    } else {
        createAnonymousUser();
    }
    updateUserDisplayUI();
}

// Create an anonymous user account
function createAnonymousUser() {
    const timestamp = Date.now();
    currentUser = {
        username: `guest_${timestamp}`,
        totalPoints: 0,
        locationsFound: [],
        completedAt: null,
        createdAt: new Date().toISOString(),
        isAnonymous: true
    };
    saveUserToLocalStorage();
}

// Save user to localStorage and cookie for persistence
function saveUserToLocalStorage() {
    const data = JSON.stringify(currentUser);
    localStorage.setItem('rasnov_user', data);
    try {
        setCookie('rasnov_user', data);
    } catch (e) {
        console.warn('Could not save progress to cookie:', e);
    }
}

// Set a custom username for the user
function setUsername(username) {
    if (!username || username.trim() === '') {
        showNotification('Please enter a valid username', 'warning');
        return false;
    }
    
    currentUser.username = username.trim();
    currentUser.isAnonymous = false;
    saveUserToLocalStorage();
    updateUserDisplayUI();
    showNotification(`Welcome, ${username}!`, 'success');
    return true;
}

// Award points for finding a location
async function awardPoints(locationKey, locationName) {
    if (!currentUser) return;
    
    const isAlreadyFound = currentUser.locationsFound.includes(locationKey);
    if (isAlreadyFound) {
        console.log(`Location ${locationKey} already found by user`);
        return;
    }
    
    const isCompletion = foundLocations.size === Object.keys(huntLocations).length;
    
    // Add to user's found locations
    currentUser.locationsFound.push(locationKey);
    
    // Calculate points
    const pointsAwarded = POINTS_PER_LOCATION;
    let bonusPoints = 0;
    
    if (isCompletion) {
        bonusPoints = COMPLETION_BONUS;
        currentUser.completedAt = new Date().toISOString();
    }
    
    currentUser.totalPoints += pointsAwarded + bonusPoints;
    
    // Save to localStorage
    saveUserToLocalStorage();
    
    // Try to sync with server if endpoint is available (optional)
    try {
        const response = await fetch(`/api/user/${encodeURIComponent(currentUser.username)}/location-found`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locationKey,
                locationName,
                isCompletion
            })
        });
        
        if (!response.ok && response.status !== 400) {
            console.warn('Failed to sync points with server:', response.statusText);
        }
    } catch (e) {
        console.log('Server sync unavailable (offline mode):', e.message);
    }
    
    // Update UI
    updateUserDisplayUI();
    
    // Show points notification
    showPointsNotification(pointsAwarded, bonusPoints, locationName);
    
    return {
        pointsAwarded,
        bonusPoints,
        totalPoints: currentUser.totalPoints
    };
}

// Update user display in header
function updateUserDisplayUI() {
    const userElement = document.getElementById('user-points-display');
    if (userElement && currentUser) {
        userElement.innerHTML = `
            <span class="user-name">${currentUser.username}</span>
            <span class="user-points">⭐ ${currentUser.totalPoints} pts</span>
        `;
    }
}

// Show a celebration notification when points are earned
function showPointsNotification(points, bonusPoints = 0, locationName = '') {
    let message = `<strong>+${points} points</strong>`;
    if (locationName) {
        message = `<strong>${locationName}</strong><br>+${points} points`;
    }
    if (bonusPoints > 0) {
        message += `<br><strong>🎉 +${bonusPoints} completion bonus!</strong>`;
    }
    
    const notificationEl = document.createElement('div');
    notificationEl.className = 'points-notification';
    notificationEl.innerHTML = message;
    document.body.appendChild(notificationEl);
    
    // Animate in
    setTimeout(() => notificationEl.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notificationEl.classList.remove('show');
        setTimeout(() => notificationEl.remove(), 300);
    }, 3000);
}

// Show user profile modal
function showUserProfile() {
    if (!currentUser) return;
    
    const profileHTML = `
        <div class="user-profile-modal">
            <div class="profile-header">
                <h2>Your Profile</h2>
                <button class="modal-close" onclick="closeModal('user-profile-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="profile-content">
                <div class="profile-stat">
                    <span class="stat-label">Username</span>
                    <span class="stat-value">${currentUser.username}</span>
                </div>
                <div class="profile-stat">
                    <span class="stat-label">Total Points</span>
                    <span class="stat-value" style="color: #f39c12; font-weight: bold;">⭐ ${currentUser.totalPoints}</span>
                </div>
                <div class="profile-stat">
                    <span class="stat-label">Locations Found</span>
                    <span class="stat-value">${currentUser.locationsFound.length} / 8</span>
                </div>
                <div class="profile-stat">
                    <span class="stat-label">Hunt Status</span>
                    <span class="stat-value">${currentUser.completedAt ? '✅ Completed' : '🔄 In Progress'}</span>
                </div>
                ${currentUser.completedAt ? `
                    <div class="profile-stat">
                        <span class="stat-label">Completed Date</span>
                        <span class="stat-value">${new Date(currentUser.completedAt).toLocaleDateString()}</span>
                    </div>
                ` : ''}
            </div>
            <div class="profile-actions">
                ${currentUser.isAnonymous ? `
                    <div style="margin-bottom: 1rem;">
                        <input type="text" id="new-username" placeholder="Enter username" maxlength="20" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; width: 100%;">
                        <button class="card-button" style="width: 100%; margin-top: 0.5rem;" onclick="updateUsernameInModal()">Set Username</button>
                    </div>
                ` : ''}
                <button class="card-button" onclick="resetProgress()">Reset Progress</button>
            </div>
        </div>
    `;
    
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        modal.querySelector('.modal-content').innerHTML = profileHTML;
    }
}

// Update username from profile modal
function updateUsernameInModal() {
    const input = document.getElementById('new-username');
    if (input && setUsername(input.value)) {
        showUserProfile();
    }
}

// Reset all hunt progress
function resetProgress() {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        currentUser.locationsFound = [];
        currentUser.totalPoints = 0;
        currentUser.completedAt = null;
        foundLocations.clear();
        saveUserToLocalStorage();
        updateUserDisplayUI();
        updateProgress();

        // Reset hunt item UI
        huntItems.forEach(item => {
            item.classList.remove('found');
            const icon = item.querySelector('i');
            if (icon) icon.className = 'fas fa-lock';
            const photo = item.querySelector('.hunt-item-photo');
            if (photo) photo.remove();
        });

        // Clear saved photos
        Object.keys(huntLocations).forEach(key => {
            localStorage.removeItem(`ar_photo_${key}`);
        });

        // Reset hunt buttons
        huntActive = false;
        startHuntBtn.innerHTML = '<i class="fas fa-play"></i> Start Hunt';
        startHuntBtn.classList.remove('active-hunt', 'hunt-complete');
        scanQrBtn.disabled = true;
        useLocationBtn.disabled = true;

        closeModal('user-profile-modal');
        showNotification('Progress reset successfully', 'info');
    }
}

// Add a saved photo thumbnail to a hunt item element
function addPhotoToHuntItem(locationKey, huntItem) {
    if (!huntItem) return;
    const savedPhoto = localStorage.getItem(`ar_photo_${locationKey}`);
    if (savedPhoto && savedPhoto.startsWith('data:image/jpeg;base64,')) {
        const existing = huntItem.querySelector('.hunt-item-photo');
        if (existing) {
            existing.src = savedPhoto;
        } else {
            const photoEl = document.createElement('img');
            photoEl.src = savedPhoto;
            photoEl.className = 'hunt-item-photo';
            photoEl.alt = 'Grizzly bear photo';
            huntItem.appendChild(photoEl);
        }
    }
}

// Restore hunt UI state from saved user data on page load
function restoreHuntState() {
    if (!currentUser || !currentUser.locationsFound) return;

    currentUser.locationsFound.forEach(locationKey => {
        foundLocations.add(locationKey);

        const huntItem = document.querySelector(`.hunt-item[data-location="${locationKey}"]`);
        if (huntItem) {
            huntItem.classList.add('found');
            const icon = huntItem.querySelector('i');
            if (icon) icon.className = 'fas fa-check-circle';
            addPhotoToHuntItem(locationKey, huntItem);
        }
    });

    updateProgress();

    if (foundLocations.size > 0 && foundLocations.size < Object.keys(huntLocations).length) {
        huntActive = true;
        startHuntBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Hunt';
        startHuntBtn.classList.add('active-hunt');
        scanQrBtn.disabled = false;
        useLocationBtn.disabled = false;
    } else if (foundLocations.size === Object.keys(huntLocations).length) {
        startHuntBtn.innerHTML = '<i class="fas fa-trophy"></i> Completed!';
        startHuntBtn.classList.remove('active-hunt');
        startHuntBtn.classList.add('hunt-complete');
    }
}

// ==================== Scavenger Hunt Locations ====================

// Scavenger Hunt Locations (for testing and location-based discovery)
const huntLocations = {
    fortress: { 
        lat: 45.5889, lng: 25.4631, 
        name: 'Rasnov Fortress Gate', 
        qr: 'RASNOV_FORTRESS', 
        fact: 'The fortress was built in 1215 by Teutonic Knights to protect against Mongol invasions.',
        hint: 'Next, discover the legendary source of water that saved the fortress during sieges - the Ancient Well!'
    },
    well: { 
        lat: 45.5892, lng: 25.4635, 
        name: 'Ancient Well', 
        qr: 'RASNOV_WELL', 
        fact: 'This 143-meter deep well was dug by Turkish prisoners and took 17 years to complete.',
        hint: 'Now climb high to the Watch Tower where guards kept lookout for approaching enemies!'
    },
    tower: { 
        lat: 45.5885, lng: 25.4640, 
        name: 'Watch Tower', 
        qr: 'RASNOV_TOWER', 
        fact: 'The watch tower provided 360-degree views to spot approaching enemies from miles away.',
        hint: 'Seek the Old Church where villagers found sanctuary and spiritual guidance for centuries!'
    },
    church: { 
        lat: 45.5890, lng: 25.4638, 
        name: 'Old Church', 
        qr: 'RASNOV_CHURCH', 
        fact: 'This Gothic church dates back to the 14th century and still holds services today.',
        hint: 'Journey to the Village Museum to explore authentic Romanian traditions and artifacts!'
    },
    museum: { 
        lat: 45.5850, lng: 25.4600, 
        name: 'Village Museum', 
        qr: 'RASNOV_MUSEUM', 
        fact: 'The museum houses over 300 artifacts showcasing traditional Romanian village life.',
        hint: 'Adventure awaits at the Mountain Peak - breathtaking views from 1650m elevation!'
    },
    peak: { 
        lat: 45.5700, lng: 25.4500, 
        name: 'Mountain Peak', 
        qr: 'RASNOV_PEAK', 
        fact: 'At 1650m elevation, this peak offers views of the entire Barsa region on clear days.',
        hint: 'Head down to the historic Town Square where markets and festivals have thrived for 600 years!'
    },
    square: { 
        lat: 45.5880, lng: 25.4620, 
        name: 'Town Square', 
        qr: 'RASNOV_SQUARE', 
        fact: 'The town square has been a gathering place for markets and festivals for over 600 years.',
        hint: 'One more adventure awaits - visit the amazing Dino Park with life-size dinosaur replicas!'
    },
    dino: { 
        lat: 45.5895, lng: 25.4625, 
        name: 'Dino Park Entrance', 
        name_ro: 'Intrarea Dino Parc',
        qr: 'RASNOV_DINO', 
        fact: 'Dino Park features over 100 life-size dinosaur replicas in their natural habitat settings.',
        fact_ro: 'Dino Parc are peste 100 de replici de dinozauri la scară naturală în habitat similar.',
        hint: 'Congratulations! You\'ve completed the entire Rasnov scavenger hunt! 🎉',
        hint_ro: 'Felicitări! Ai terminat întreaga vânătoare în Râșnov! 🎉'
    }
};

// Helper to get localized field from objects like huntLocations
function localizedField(obj, field) {
    if (currentLang && currentLang !== 'en') {
        const key = `${field}_` + currentLang;
        if (obj[key]) return obj[key];
    }
    return obj[field] || '';
}

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

// Test Location Button - Launch AR for first unfound location
testLocationBtn.addEventListener('click', () => {
    // Find first unfound location
    const locationKeys = Object.keys(huntLocations);
    let targetLocation = locationKeys[0]; // Default to fortress
    
    for (const key of locationKeys) {
        if (!foundLocations.has(key)) {
            targetLocation = key;
            break;
        }
    }
    
    // Check if browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotification('Camera access is not supported on this browser. Please use a modern browser with HTTPS.', 'error');
        return;
    }
    
    showNotification(`Testing AR at ${huntLocations[targetLocation].name}...`, 'info');
    launchARExperience(targetLocation, true);
});

// AR Close Button
arCloseBtn.addEventListener('click', () => {
    closeARView();
});

// AR Capture Button – take photo of the bear
arCaptureBtn.addEventListener('click', () => {
    captureARPhoto();
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
            inversionAttempts: "attemptBoth",
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
    const header = translateMessage('Select a QR Code to Scan:');
    qrScanner.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <h4>${header}</h4>
            <div style="display: grid; gap: 1rem; margin-top: 1rem;">
                ${Object.entries(huntLocations).map(([key, loc]) => `
                    <button class="card-button" onclick="simulateQRScan('${key}')">${localizedField(loc, 'name') || loc.name}</button>
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
                // Launch AR experience instead of just discovering
                launchARExperience(key, false);
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
        // Add photo thumbnail below the hunt item
        addPhotoToHuntItem(locationKey, huntItem);
    }
    
    // Award points to user
    const location = huntLocations[locationKey];
    const localizedName = localizedField(location, 'name') || location.name;
    const isCompletion = foundLocations.size === Object.keys(huntLocations).length;
    const pointsResult = awardPoints(locationKey, localizedName);
    
    // Update progress
    updateProgress();
    
    // Show discovery modal with points
    const localizedFact = localizedField(location, 'fact') || location.fact || '';
    const discoveryMsg = (currentLang === 'ro') ? 'Felicitări pentru explorare!' : 'Great job exploring Rasnov!';

    document.getElementById('discovery-title').textContent = (currentLang === 'ro') ? `Ai găsit ${localizedName}!` : `You found ${localizedName}!`;
    document.getElementById('discovery-message').textContent = discoveryMsg;
    
    let factHTML = `<strong>${currentLang === 'ro' ? 'Curiozitate' : 'Fun Fact'}:</strong> ${localizedFact}`;
    if (pointsResult) {
        let pointsText = `<br><br><strong>Points Earned: +${pointsResult.pointsAwarded}</strong>`;
        if (pointsResult.bonusPoints > 0) {
            pointsText += `<br><strong>🎉 Completion Bonus: +${pointsResult.bonusPoints}</strong>`;
            pointsText += `<br><strong>Total Points: ${pointsResult.totalPoints}</strong>`;
        }
        factHTML += pointsText;
    }
    
    // Show saved AR photo if available (validate it's a safe JPEG data URL)
    const savedPhoto = localStorage.getItem(`ar_photo_${locationKey}`);
    if (savedPhoto && savedPhoto.startsWith('data:image/jpeg;base64,')) {
        factHTML += `<br><p class="ar-photo-label">📸 Your Grizzly photo:</p><img src="${savedPhoto}" class="ar-captured-photo" alt="Your AR bear photo at ${localizedName}">`;
    }
    
    document.getElementById('discovery-fact').innerHTML = factHTML;
    openModal('discovery-modal');
    
    // Check if hunt is complete
    if (foundLocations.size === Object.keys(huntLocations).length) {
        setTimeout(() => {
            const celebrationMsg = (currentLang === 'ro') 
                ? `🎉 Felicitări! Ai completat vânătoarea! Total puncte: ${currentUser.totalPoints}` 
                : `🎉 Congratulations! You completed the scavenger hunt! Total points: ${currentUser.totalPoints}`;
            showNotification(celebrationMsg, 'success');
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

// AR Camera Functions
async function launchARExperience(locationKey, isTestMode = false) {
    currentARLocation = locationKey;
    const location = huntLocations[locationKey];
    
    // Check if HTTPS (required for camera access in production)
    const isSecure = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!isSecure && !isLocalhost) {
        showNotification('AR camera requires HTTPS. Please access the site via https:// to use AR features.', 'error');
        // Fallback to regular discovery for non-HTTPS production
        setTimeout(() => {
            discoverLocation(locationKey);
        }, 500);
        return;
    }
    
    // Show AR modal
    arModal.classList.add('active');
    arLoading.classList.remove('hidden');
    arOverlayText.classList.add('hidden');
    arBearReady = false;
    
    // Update hunt instruction banner
    const locName = localizedField(location, 'name') || location.name;
    arHuntText.textContent = (currentLang === 'ro')
        ? `Găsește Grizzly la ${locName} și fă o poză!`
        : `Find Grizzly at the ${locName} and take a picture!`;
    arHuntBanner.style.display = 'flex';
    
    // Show test mode indicator if applicable
    if (isTestMode) {
        arTestModeIndicator.style.display = 'flex';
    } else {
        arTestModeIndicator.style.display = 'none';
    }
    
    try {
        // Request camera permission and initialize
        await initializeARCamera();
        
        // Setup AR scene with 3D bear
        setupARScene(locationKey);
        
        // Hide loading indicator
        arLoading.classList.add('hidden');
        
    } catch (error) {
        console.error('AR Camera Error:', error);
        
        // In test mode, show demo view even without camera
        if (isTestMode) {
            arLoading.classList.add('hidden');
            
            // Setup AR scene without camera (will show placeholder)
            setupARScene(locationKey);
            
            return;
        }
        
        arLoading.classList.add('hidden');
        
        // Show user-friendly error message
        let errorMessage = 'Unable to access camera. ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please allow camera access to use AR features.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Camera not supported on this browser. Please use HTTPS.';
        } else {
            errorMessage += 'Please check your camera settings.';
        }
        
        showNotification(errorMessage, 'error');
        
        // Close AR modal and fallback to regular discovery
        closeARView();
        setTimeout(() => {
            discoverLocation(locationKey);
        }, 500);
    }
}

async function initializeARCamera() {
    try {
        // Request camera access
        const constraints = {
            video: {
                facingMode: 'environment', // Use back camera on mobile
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        arStream = await navigator.mediaDevices.getUserMedia(constraints);
        return arStream;
    } catch (error) {
        throw error;
    }
}

function setupARScene(locationKey) {
    const location = huntLocations[locationKey];
    
    // Clear previous scene
    arSceneContainer.innerHTML = '';
    
    // Create video element for camera feed
    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.id = 'ar-camera-feed';
    video.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 1;
    `;
    
    // Attach camera stream to video or show placeholder
    if (arStream) {
        video.srcObject = arStream;
        video.play().catch(err => console.warn('Video autoplay failed:', err));
    } else {
        // Show placeholder when camera is not available (for demo/testing)
        video.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        const placeholder = document.createElement('div');
        placeholder.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 24px;
            text-align: center;
            z-index: 2;
        `;
        placeholder.textContent = '📷';
        const lineBreak1 = document.createElement('br');
        const cameraText = document.createTextNode('Camera View');
        const lineBreak2 = document.createElement('br');
        const smallText = document.createElement('small');
        smallText.style.fontSize = '14px';
        smallText.textContent = '(Placeholder)';
        
        placeholder.appendChild(lineBreak1);
        placeholder.appendChild(cameraText);
        placeholder.appendChild(lineBreak2);
        placeholder.appendChild(smallText);
        arSceneContainer.appendChild(placeholder);
    }
    
    arSceneContainer.appendChild(video);
    
    // Setup 3D bear (Three.js) or walking bear fallback
    setupBearAR(locationKey);
}

// ── Public bear GLTF model (Quaternius free CC0 bear via public CDN) ──────────
// If the 3D model fails to load, we fall back to an animated bear emoji overlay.
// To use a local model instead: download the bear.glb from
//   https://quaternius.com/packs/ultimateanimals.html (free CC0)
// place it at /assets/bear.glb and change the URL below.
const BEAR_MODEL_URL = 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/bear/model.gltf';

function setupBearAR(locationKey) {
    // Try Three.js 3D bear first.
    // The legacy examples/js GLTFLoader registers itself as THREE.GLTFLoader.
    // Also check the global GLTFLoader as a fallback for environments where
    // it doesn't attach to the THREE namespace.
    const hasThree = typeof THREE !== 'undefined';
    const hasGLTFLoader = hasThree && (typeof THREE.GLTFLoader !== 'undefined' || typeof GLTFLoader !== 'undefined');
    if (hasThree && hasGLTFLoader) {
        _setup3DBear(locationKey);
    } else {
        _setupBearFallback();
    }
}

function _setup3DBear(locationKey) {
    const container = arSceneContainer;
    const w = container.offsetWidth || window.innerWidth;
    const h = container.offsetHeight || window.innerHeight;

    // Three.js renderer (transparent background so camera shows through)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.domElement.className = 'ar-three-canvas';
    container.appendChild(renderer.domElement);
    arThreeRenderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 1.5, 6);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 5);
    scene.add(sun);

    const clock = new THREE.Clock();
    arThreeClock = clock;

    // Bear walk-in constants
    const BEAR_WALK_START_X = 6;  // start off-screen right
    const BEAR_BASE_Y = -1;        // resting vertical position
    const HOP_COUNT = 4;           // number of hops during walk-in
    const HOP_HEIGHT = 0.6;        // peak hop height in world units

    // Load GLTF bear
    const LoaderClass = (typeof THREE.GLTFLoader !== 'undefined') ? THREE.GLTFLoader : GLTFLoader;
    const loader = new LoaderClass();
    let bearGroup = null;
    let walkX = BEAR_WALK_START_X;

    loader.load(
        BEAR_MODEL_URL,
        (gltf) => {
            bearGroup = gltf.scene;
            bearGroup.scale.set(1.2, 1.2, 1.2);
            bearGroup.position.set(walkX, BEAR_BASE_Y, 0);
            // Face left (toward center)
            bearGroup.rotation.y = -Math.PI / 2;
            scene.add(bearGroup);

            // Play animation if available
            if (gltf.animations && gltf.animations.length) {
                arThreeMixer = new THREE.AnimationMixer(bearGroup);
                const clip = gltf.animations[0];
                arThreeMixer.clipAction(clip).play();
            }

            arBearReady = true;
            // Notify once bear is loaded and walks into view
            // (notification shown when walking completes in animate loop)
        },
        undefined,
        (err) => {
            console.warn('3D bear model failed to load, using fallback.', err);
            // Cleanup Three.js canvas and use emoji fallback
            if (renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer.dispose();
            arThreeRenderer = null;
            _setupBearFallback();
        }
    );

    // Animation loop
    function animate() {
        arAnimationId = requestAnimationFrame(animate);
        const delta = clock.getDelta();

        if (arThreeMixer) arThreeMixer.update(delta);

        if (bearGroup) {
            // Walk bear in from right to center over ~2.5s with hopping
            if (walkX > 0) {
                walkX -= delta * 2.4;
                const clampedX = Math.max(walkX, 0);
                bearGroup.position.x = clampedX;
                // Hop: sine wave tied to horizontal progress
                const progress = (BEAR_WALK_START_X - clampedX) / BEAR_WALK_START_X;
                bearGroup.position.y = BEAR_BASE_Y + Math.max(0, Math.sin(progress * Math.PI * HOP_COUNT)) * HOP_HEIGHT;
                if (walkX <= 0) {
                    bearGroup.position.y = BEAR_BASE_Y;
                    arBearReady = true;
                    showNotification('🐻 Grizzly is here! Take a photo!', 'info');
                }
            }
        }

        renderer.render(scene, camera);
    }
    animate();
}

function _setupBearFallback() {
    // Animated emoji bear that walks in from the right
    const bear = document.createElement('div');
    bear.className = 'ar-bear-placeholder';
    bear.id = 'ar-bear-placeholder';
    bear.textContent = '🐻';
    bear.setAttribute('role', 'img');
    bear.setAttribute('aria-label', 'Grizzly Bear');
    arSceneContainer.appendChild(bear);

    // After walk-in animation completes, switch to idle
    setTimeout(() => {
        bear.classList.add('idle');
        arBearReady = true;
        showNotification('🐻 Grizzly is here! Take a photo!', 'info');
    }, 3300); // walk-in animation: 1.2s delay + 2s duration
}

function captureARPhoto() {
    if (!currentARLocation) return;

    // Require bear to be on screen before taking a photo
    if (!arBearReady) {
        showNotification('🐻 Wait for Grizzly to hop onto the screen first!', 'warning');
        return;
    }

    // Use a canvas to composite camera feed + bear overlay
    const video = document.getElementById('ar-camera-feed');
    const captureCanvas = document.createElement('canvas');
    const cw = video ? video.videoWidth || 640 : 640;
    const ch = video ? video.videoHeight || 480 : 480;
    captureCanvas.width = cw;
    captureCanvas.height = ch;
    const ctx = captureCanvas.getContext('2d');

    // Draw camera frame (or solid bg if no camera)
    if (video && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, cw, ch);
    } else {
        ctx.fillStyle = '#334';
        ctx.fillRect(0, 0, cw, ch);
    }

    // Overlay bear at its actual on-screen position
    if (arThreeRenderer) {
        // Composite the Three.js WebGL canvas on top of the camera frame
        ctx.drawImage(arThreeRenderer.domElement, 0, 0, cw, ch);
    } else {
        // Emoji fallback – calculate real rendered position of bear element
        const bearEl = document.getElementById('ar-bear-placeholder');
        if (bearEl) {
            const containerRect = arSceneContainer.getBoundingClientRect();
            const bearRect = bearEl.getBoundingClientRect();
            const scaleX = cw / containerRect.width;
            const scaleY = ch / containerRect.height;
            const bearCenterX = (bearRect.left + bearRect.width / 2 - containerRect.left) * scaleX;
            const bearCenterY = (bearRect.top + bearRect.height / 2 - containerRect.top) * scaleY;
            const bearFontSize = Math.round(bearRect.height * scaleY);
            ctx.font = `${bearFontSize}px 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 16;
            ctx.fillText('🐻', bearCenterX, bearCenterY);
        } else {
            // Final fallback to fixed position
            ctx.font = `${Math.round(ch * 0.2)}px 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 16;
            ctx.fillText('🐻', cw * 0.65, ch * 0.85);
        }
    }

    // Timestamp watermark
    ctx.shadowBlur = 0;
    ctx.font = `bold ${Math.round(cw * 0.03)}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('📍 Rasnov Scavenger Hunt', 10, ch - 8);

    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.82);

    // Save photo to localStorage under location key
    try {
        localStorage.setItem(`ar_photo_${currentARLocation}`, dataUrl);
    } catch (e) {
        // localStorage quota exceeded or unavailable
        console.warn('Could not save photo to localStorage (storage full?)', e);
        showNotification('📸 Photo taken! (Could not save – storage full)', 'warning');
    }

    // Flash effect
    arFlash.classList.add('flashing');
    arFlash.addEventListener('animationend', () => arFlash.classList.remove('flashing'), { once: true });

    // Capture button feedback
    arCaptureBtn.classList.add('captured');
    arCaptureBtn.innerHTML = '<i class="fas fa-check"></i>';

    // Award points and show discovery after a short delay
    setTimeout(() => {
        const locKey = currentARLocation;
        closeARView();
        if (!foundLocations.has(locKey)) {
            discoverLocation(locKey);
        } else {
            showNotification('📸 Photo saved! You already found this location.', 'info');
        }
    }, 600);
}

function discoverLocationQuietly(locationKey) {
    // Same as discoverLocation but without showing the modal
    foundLocations.add(locationKey);
    
    // Update UI
    const huntItem = document.querySelector(`.hunt-item[data-location="${locationKey}"]`);
    if (huntItem) {
        huntItem.classList.add('found');
        huntItem.querySelector('i').className = 'fas fa-check-circle';
    }
    
    // Update progress
    updateProgress();
    
    // Check if hunt is complete
    if (foundLocations.size === Object.keys(huntLocations).length) {
        setTimeout(() => {
            showNotification('🎉 Congratulations! You completed the scavenger hunt!', 'success');
            huntActive = false;
            startHuntBtn.innerHTML = '<i class="fas fa-trophy"></i> Completed!';
            startHuntBtn.classList.remove('active-hunt');
            startHuntBtn.classList.add('hunt-complete');
        }, 1000);
    }
}

function closeARView() {
    // Hide AR modal
    arModal.classList.remove('active');
    
    // Cancel Three.js animation loop
    if (arAnimationId !== null) {
        cancelAnimationFrame(arAnimationId);
        arAnimationId = null;
    }
    
    // Dispose Three.js renderer
    if (arThreeRenderer) {
        arThreeRenderer.dispose();
        arThreeRenderer = null;
    }
    arThreeMixer = null;
    arThreeClock = null;
    arBearReady = false;
    
    // Stop all video tracks from the camera stream
    if (arStream) {
        arStream.getTracks().forEach(track => {
            track.stop();
            console.log('Stopped camera track:', track.label);
        });
        arStream = null;
    }
    
    // Find and stop any video elements in the AR scene
    const videoElements = arSceneContainer.querySelectorAll('video');
    videoElements.forEach(video => {
        video.pause();
        video.srcObject = null;
        video.load(); // Reset video element
    });
    
    // Clear AR scene completely
    arSceneContainer.innerHTML = '';
    
    // Reset capture button
    arCaptureBtn.classList.remove('captured');
    arCaptureBtn.innerHTML = '<i class="fas fa-camera"></i>';
    
    // Reset overlay
    arOverlayText.classList.add('hidden');
    
    // Reset state
    currentARLocation = null;
    arTestModeIndicator.style.display = 'none';
    
    console.log('AR view closed, camera stopped');
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
    // Translate notifications if needed
    message = translateMessage(message);

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
            title_ro: 'Cetatea Râșnov',
            description: 'Built in the 13th century by Teutonic Knights, Rasnov Fortress is a stunning example of medieval defensive architecture. The fortress sits atop a rocky hilltop and offers breathtaking panoramic views of the surrounding Carpathian Mountains and Barsa Valley.',
            description_ro: 'Construită în secolul al XIII-lea de Cavalerii Teutoni, Cetatea Râșnov este un exemplu impresionant de arhitectură defensivă medievală. Aflată pe un deal stâncos, oferă priveliști panoramice spectaculoase ale Munților Carpați și ale Văii Bârsei.',
            hours: 'Daily: 9:00 AM - 6:00 PM (Summer), 9:00 AM - 5:00 PM (Winter)',
            hours_ro: 'Zilnic: 9:00 AM - 6:00 PM (Vară), 9:00 AM - 5:00 PM (Iarnă)',
            price: 'Adults: 20 RON, Children: 10 RON, Students: 15 RON',
            price_ro: 'Adulți: 20 RON, Copii: 10 RON, Studenți: 15 RON',
            tips: 'Wear comfortable shoes for climbing. Visit early morning for best photos. Allow 2-3 hours for full exploration.',
            tips_ro: 'Purtați pantofi confortabili pentru urcare. Vizitați dimineață devreme pentru cele mai bune fotografii. Acordați 2-3 ore pentru explorare completă.'
        },
        dinoparc: {
            title: 'Dino Parc',
            title_ro: 'Dino Parc',
            description: 'The largest dinosaur park in Southeast Europe featuring over 100 life-size animatronic dinosaurs. An educational and entertaining experience for the whole family with interactive exhibits and fossil displays.',
            description_ro: 'Cel mai mare parc cu dinozauri din Europa de Sud-Est, cu peste 100 de replici animatronice la scară naturală. Experiență educațională și distractivă pentru întreaga familie cu expozițiile interactive și colecția de fosile.',
            hours: 'Daily: 10:00 AM - 7:00 PM (April-October)',
            hours_ro: 'Zilnic: 10:00 AM - 7:00 PM (Aprilie-Octombrie)',
            price: 'Adults: 40 RON, Children (3-14): 30 RON, Family pass: 120 RON',
            price_ro: 'Adulți: 40 RON, Copii (3-14): 30 RON, Abonament familial: 120 RON',
            tips: 'Perfect for families with children. Best visited in good weather. Combined tickets with fortress available.',
            tips_ro: 'Perfect pentru familii cu copii. Best vizitat în vreme bună. Bilete combinate cu cetatea disponibile.'
        },
        peak: {
            title: 'Piatra Mica Peak',
            title_ro: 'Piatra Mică',
            description: 'A stunning mountain peak accessible by cable car or hiking trail. The peak offers spectacular 360-degree views of the Carpathian Mountains, Bucegi Plateau, and surrounding valleys.',
            description_ro: 'Un vârf montan impresionant accesibil cu telescaunul sau pe traseu de drumeție. Vârful oferă priveliști spectaculoase de 360 de grade ale Munților Carpați, Platoul Bucegi și ale văilor înconjurătoare.',
            hours: 'Cable car: 9:00 AM - 5:00 PM (Weather dependent)',
            hours_ro: 'Telescaun: 9:00 AM - 5:00 PM (În funcție de vreme)',
            price: 'Cable car round trip: 30 RON, Hiking: Free',
            price_ro: 'Telescaun dus-întors: 30 RON, Drumeție: Gratuit',
            tips: 'Check weather before going. Bring warm layers as it can be windy. Hiking takes 3-4 hours up.',
            tips_ro: 'Verificați vremea înainte de plecare. Duceți straturi calde deoarece poate fi vântos. Drumeția durează 3-4 ore în sus.'
        },
        museum: {
            title: 'Village Museum',
            title_ro: 'Muzeul Satului',
            description: 'An authentic collection of traditional Romanian rural houses, tools, and artifacts. Learn about the rich cultural heritage and daily life of Transylvanian villages through the centuries.',
            description_ro: 'O colecție autentică de case tradiționale românești, unelte și artefacte. Aflați despre moștenirea culturală bogată și viața cotidiană a satelor transilvane de-a lungul secolelor.',
            hours: 'Tuesday-Sunday: 10:00 AM - 5:00 PM (Closed Mondays)',
            hours_ro: 'Marți-Duminică: 10:00 AM - 5:00 PM (Închis luni)',
            price: 'Adults: 10 RON, Children: 5 RON, Guided tours: +15 RON',
            price_ro: 'Adulți: 10 RON, Copii: 5 RON, Ture ghidate: +15 RON',
            tips: 'Guided tours available in English. Photography allowed. Visit local craft demonstrations on weekends.',
            tips_ro: 'Ture ghidate disponibile în limba engleză. Fotografia este permisă. Vizitați demonstrații locale de meșteșuguri în weekend.'
        },
        bran: {
            title: 'Bran Castle',
            title_ro: 'Castelul Bran',
            description: 'Famous as "Dracula\'s Castle", this Gothic fortress is steeped in legend and history. The castle offers fascinating exhibits about medieval life and the region\'s royal history.',
            description_ro: 'Faimos ca "Castelul lui Dracula", această fortăreață gotică este plinul de legendă și istorie. Castelul oferă expozițiile fascinante despre viața medievală și istoria regală a regiunii.',
            hours: 'Monday: 12:00 PM - 6:00 PM, Tuesday-Sunday: 9:00 AM - 6:00 PM',
            hours_ro: 'Luni: 12:00 PM - 6:00 PM, Marți-Duminică: 9:00 AM - 6:00 PM',
            price: 'Adults: 45 RON, Students: 25 RON, Children: 10 RON',
            price_ro: 'Adulți: 45 RON, Studenți: 25 RON, Copii: 10 RON',
            tips: 'Very popular - arrive early or late to avoid crowds. Allow 1.5-2 hours. Combined tickets with Peles available.',
            tips_ro: 'Foarte popular - sosire devreme sau târziu pentru a evita aglomerația. Acordați 1,5-2 ore. Bilete combinate cu Peleș disponibile.'
        },
        poiana: {
            title: 'Poiana Brasov Ski Resort',
            title_ro: 'Stațiunea Poiana Brașov',
            description: 'Premier ski resort with 23km of slopes for all skill levels. In summer, offers hiking, mountain biking, and stunning alpine scenery.',
            description_ro: 'Stațiune de schi de primă clasă cu 23 km de pârtii pentru toate nivelurile de abilitate. În vară, oferă drumeții, mountain biking și peisaje alpine impresionante.',
            hours: 'Ski Season: December-March, 8:00 AM - 4:00 PM. Summer activities: May-October',
            hours_ro: 'Sezonul de schi: Decembrie-Martie, 8:00 AM - 4:00 PM. Activități de vară: Mai-Octombrie',
            price: 'Ski pass: 150 RON/day, Equipment rental: 80 RON/day',
            price_ro: 'Pasul de schi: 150 RON/zi, Închiriere echipament: 80 RON/zi',
            tips: 'Book lessons in advance. Multiple difficulty levels available. Great apres-ski scene.',
            tips_ro: 'Rezervați lecții în avans. Niveluri de dificultate multiple disponibile. Scenă apres-ski grozavă.'
        },
        brasov: {
            title: 'Brasov Old Town',
            title_ro: 'Centrul Istoric Brașov',
            description: 'Medieval city center featuring the impressive Black Church, colorful baroque buildings, and the famous Council Square. Charming cobblestone streets perfect for walking.',
            description_ro: 'Centru medieval cu Biserica Neagră impresionantă, clădiri baroc colorate și Piața Sfatului faimoasă. Străzi pietruite fermecătoare, perfect pentru plimbări.',
            hours: 'Always accessible (individual attractions vary)',
            hours_ro: 'Întotdeauna accesibil (atracciile individuale variază)',
            price: 'Free to walk around, Black Church: 10 RON',
            price_ro: 'Gratuit pentru a merge pe jos, Biserica Neagră: 10 RON',
            tips: 'Don\'t miss Council Square and Rope Street (narrowest street). Great shopping and dining options.',
            tips_ro: 'Nu pierdeți Piața Sfatului și Strada Șnurului (cea mai îngustă stradă). Opțiuni minunate de cumpărături și mâncare.'
        },
        peles: {
            title: 'Peles Castle',
            title_ro: 'Castelul Peleș',
            description: 'One of Europe\'s most beautiful castles, this Neo-Renaissance masterpiece features 160 rooms with stunning art, furniture, and architecture. Former royal summer residence.',
            description_ro: 'Unul dintre cele mai frumoase castele ale Europei, această capodoperă neo-renascentistă are 160 de camere cu artă, mobilă și arhitectură impresionante. Foste reședință de vară regală.',
            hours: 'Wednesday-Sunday: 9:15 AM - 5:00 PM (Closed Monday-Tuesday)',
            hours_ro: 'Miercuri-Duminică: 9:15 AM - 5:00 PM (Închis luni-marți)',
            price: 'Adults: 50 RON, Students: 12.5 RON. Photo permit: 35 RON',
            price_ro: 'Adulți: 50 RON, Studenți: 12,5 RON. Permis foto: 35 RON',
            tips: 'Book online to skip lines. Guided tours mandatory. Photography not allowed inside without permit.',
            tips_ro: 'Rezervați online pentru a sări peste cozi. Ture ghidate obligatorii. Fotografia nu este permisă în interior fără permis.'
        },
        'national-park': {
            title: 'Piatra Craiului National Park',
            title_ro: 'Parcul Național Piatra Craiului',
            description: 'Protected mountain range with dramatic limestone ridge. Home to rare wildlife including chamois, lynx, and brown bears. Pristine alpine meadows and forests.',
            description_ro: 'Lanț montan protejat cu creastă calcaroasă dramatică. Acasă pentru faunul rar, inclusiv chamois, lincele și ursul brun. Pajiști și păduri alpine neîntinse.',
            hours: 'Always open (visitor center: 9:00 AM - 5:00 PM)',
            hours_ro: 'Întotdeauna deschis (centrul de vizitatori: 9:00 AM - 5:00 PM)',
            price: 'Free entry, Guided tours: 100-200 RON',
            price_ro: 'Intrare gratuită, Ture ghidate: 100-200 RON',
            tips: 'Stay on marked trails. Bring proper hiking gear. Best months: June-September. Bear-safe practices required.',
            tips_ro: 'Rămâneți pe traseele marcate. Duceți echipamentul de drumeție adecvat. Luni optime: iunie-septembrie. Practici sigure cu ursul necesare.'
        },
        'bear-sanctuary': {
            title: 'Libearty Bear Sanctuary',
            title_ro: 'Sanctuarul pentru Urși Libearty',
            description: 'Europe\'s largest brown bear sanctuary, home to over 100 rescued bears. Ethical tourism supporting bear conservation and welfare in natural forest habitat.',
            description_ro: 'Cel mai mare sanctuar pentru ursul brun din Europa, gazda pentru peste 100 de urși salvați. Turism etic care să susțină conservarea și bunăstarea ursului în habitat forestier natural.',
            hours: 'Daily: 9:00 AM - 7:00 PM (April-October), 9:00 AM - 5:00 PM (November-March)',
            hours_ro: 'Zilnic: 9:00 AM - 7:00 PM (Aprilie-Octombrie), 9:00 AM - 5:00 PM (Noiembrie-martie)',
            price: 'Adults: 25 RON, Children: 15 RON, Family: 60 RON',
            price_ro: 'Adulți: 25 RON, Copii: 15 RON, Familie: 60 RON',
            tips: 'Allow 1.5 hours. Bears most active in morning/evening. Support conservation by not feeding wildlife.',
            tips_ro: 'Acordați 1,5 ore. Urșii sunt cei mai activi dimineață/seară. Susțineți conservarea prin a nu hrăni fauna sălbatică.'
        }
    };
    
    const detail = details[locationId];
    if (detail) {
        const title = (currentLang === 'ro' && detail.title_ro) ? detail.title_ro : detail.title;
        const description = (currentLang === 'ro' && detail.description_ro) ? detail.description_ro : detail.description;
        const hours = (currentLang === 'ro' && detail.hours_ro) ? detail.hours_ro : detail.hours;
        const price = (currentLang === 'ro' && detail.price_ro) ? detail.price_ro : detail.price;
        const tips = (currentLang === 'ro' && detail.tips_ro) ? detail.tips_ro : detail.tips;

        document.getElementById('details-title').textContent = title;
        document.getElementById('details-content').innerHTML = `
            <p><strong>${currentLang === 'ro' ? 'Despre' : 'About'}:</strong> ${description}</p>
            <p><strong>${currentLang === 'ro' ? 'Ore' : 'Hours'}:</strong> ${hours}</p>
            <p><strong>${currentLang === 'ro' ? 'Preț' : 'Price'}:</strong> ${price}</p>
            <p><strong>${currentLang === 'ro' ? 'Sfaturi' : 'Tips'}:</strong> ${tips}</p>
        `;
        openModal('details-modal');
    }
}

function showRestaurantDetails(restaurantId) {
    const details = {
        cetate: {
            title: 'Cetate Restaurant',
            title_ro: 'Restaurant Cetate',
            menu: 'Sarmale (stuffed cabbage rolls), Mici (grilled meat rolls), Polenta with cheese and sour cream, Traditional soups',
            menu_ro: 'Sarmale, Mici, Mămăligă cu brânză și smântână, supe tradiționale',
            hours: '11:00 AM - 11:00 PM',
            notes: 'Reservations recommended for groups.',
            notes_ro: 'Rezervări recomandate pentru grupuri.'
        },
        ceaun: {
            title: 'La Ceaun',
            title_ro: 'La Ceaun',
            menu: 'Ciorbă (sour soup), Grilled trout, Pork steak with mushrooms, Homemade desserts',
            menu_ro: 'Ciorbă, păstrăv la grătar, friptură de porc cu ciuperci, deserturi de casă',
            hours: '12:00 PM - 10:00 PM',
            notes: 'Cozy atmosphere with fireplace.',
            notes_ro: 'Atmosferă confortabilă cu șemineu.'
        },
        pizzeria: {
            title: 'Pizzeria Castello',
            title_ro: 'Pizzeria Castello',
            menu: 'Wood-fired pizzas, Fresh pasta, Romanian-Italian fusion dishes, Tiramisu',
            menu_ro: 'Pizza la cuptorul din lemn, paste proaspete, fusion romano-italian, Tiramisu',
            hours: '11:00 AM - 11:00 PM',
            hours_ro: '11:00 AM - 11:00 PM',
            notes: 'Delivery available.',
            notes_ro: 'Livrare disponibilă.'
        },
        cafe: {
            title: 'Cafe Central',
            title_ro: 'Cafe Central',
            menu: 'Specialty coffee, Fresh pastries, Breakfast menu, Sandwiches and salads',
            menu_ro: 'Cafea de specialitate, patiserie proaspătă, meniu de micul dejun, sandwich-uri și salate',
            hours: '7:00 AM - 8:00 PM',
            hours_ro: '7:00 AM - 8:00 PM',
            notes: 'Free WiFi available.',
            notes_ro: 'WiFi gratuit disponibil.'
        },
        'belvedere-terrace': {
            title: 'Belvedere Terrace',
            title_ro: 'Terasă Belvedere',
            menu: 'International cuisine, Steaks, Seafood, Fine wines, Gourmet desserts',
            menu_ro: 'Bucătărie internațională, Friptură, Fructe de mare, Vinuri fine, Deserturi gourmet',
            hours: '12:00 PM - 11:00 PM (Kitchen closes at 10:00 PM)',
            hours_ro: '12:00 PM - 11:00 PM (Bucătăria se închide la 10:00 PM)',
            notes: 'Reservations essential for sunset dining. Dress code: Smart casual.',
            notes_ro: 'Rezervări esențiale pentru cina la apus. Cod de îmbrăcăminte: Smart casual.'
        },
        'grill-house': {
            title: 'Grill House Rasnov',
            title_ro: 'Grill House Rasnov',
            menu: 'Mixed grills, BBQ ribs, Chicken skewers, Fresh salads, Local wines and craft beers',
            menu_ro: 'Grătar mixt, Coaste BBQ, Frigărui de pui, Salate proaspete, Vinuri locale și bere artizanală',
            hours: '12:00 PM - 11:00 PM',
            hours_ro: '12:00 PM - 11:00 PM',
            notes: 'Outdoor seating available. Great for groups.',
            notes_ro: 'Locuri de ședere în aer liber. Perfect pentru grupuri.'
        },
        bistro: {
            title: 'Bistro Rasnoveana',
            title_ro: 'Bistro Rasnoveana',
            menu: 'Daily specials, Soups, Burgers, Pasta, Homemade cakes and desserts',
            menu_ro: 'Ofertele zilei, Supe, Hamburgeri, Paste, Prăjituri și deserturi de casă',
            hours: '10:00 AM - 10:00 PM',
            hours_ro: '10:00 AM - 10:00 PM',
            notes: 'Budget-friendly. Quick service. Lunch specials 11:00 AM - 2:00 PM.',
            notes_ro: 'Buget-friendly. Serviciu rapid. Oferte speciale la prânz 11:00 AM - 2:00 PM.'
        },
        vegetarian: {
            title: 'Vegetarian Haven',
            title_ro: 'Vegetarian Haven',
            menu: 'Buddha bowls, Vegan burgers, Fresh juices, Smoothies, Plant-based desserts',
            menu_ro: 'Boluri Buddha, Hamburgeri vegani, Sucuri proaspete, Smoothies, Deserturi pe bază de plante',
            hours: '9:00 AM - 9:00 PM',
            hours_ro: '9:00 AM - 9:00 PM',
            notes: 'All organic ingredients. Gluten-free options available.',
            notes_ro: 'Toate ingredientele sunt ecologice. Opțiuni fără gluten disponibile.'
        }
    };
    
    const detail = details[restaurantId];
    if (detail) {
        const title = (currentLang === 'ro' && detail.title_ro) ? detail.title_ro : detail.title;
        const menu = (currentLang === 'ro' && detail.menu_ro) ? detail.menu_ro : detail.menu;
        const notes = (currentLang === 'ro' && detail.notes_ro) ? detail.notes_ro : detail.notes;

        document.getElementById('details-title').textContent = title;
        document.getElementById('details-content').innerHTML = `
            <p><strong>${currentLang === 'ro' ? 'Meniu (repere)' : 'Menu Highlights'}:</strong> ${menu}</p>
            <p><strong>${currentLang === 'ro' ? 'Ore' : 'Hours'}:</strong> ${detail.hours}</p>
            <p><strong>${currentLang === 'ro' ? 'Notă' : 'Note'}:</strong> ${notes}</p>
        `;
        openModal('details-modal');
    }
}

function showAccommodationDetails(accommodationId) {
    const details = {
        ambient: {
            title: 'Hotel Ambient',
            title_ro: 'Hotel Ambient',
            description: '4-star hotel with spa, indoor pool, restaurant, and mountain-view rooms.',
            description_ro: 'Hotel de 4 stele cu spa, piscină interioară, restaurant și camere cu vedere la munte.',
            amenities: 'Free WiFi, parking, breakfast included',
            amenities_ro: 'WiFi gratuit, parcare, mic dejun inclus',
            price: 'From €80/night',
            contact: '+40 268 234 567'
        },
        belvedere: {
            title: 'Pension Belvedere',
            title_ro: 'Pensiunea Belvedere',
            description: 'Family-run guesthouse with traditional rooms and homemade breakfast.',
            description_ro: 'Pensiune de familie cu camere tradiționale și mic dejun de casă.',
            amenities: 'Free WiFi, parking, garden',
            amenities_ro: 'WiFi gratuit, parcare, grădină',
            price: 'From €40/night',
            contact: '+40 268 234 568'
        },
        petre: {
            title: 'Casa Petre',
            title_ro: 'Casa Petre',
            description: 'Fully equipped apartments in old town. Perfect for families or longer stays.',
            description_ro: 'Apartamente complet echipate în centrul vechi. Perfect pentru familii sau sejururi mai lungi.',
            amenities: 'Kitchen, WiFi, parking',
            amenities_ro: 'Bucătărie, WiFi, parcare',
            price: 'From €50/night',
            contact: '+40 268 234 569'
        },
        hostel: {
            title: 'Mountain Hostel',
            title_ro: 'Hostel Montan',
            description: 'Budget-friendly with dorms and private rooms.',
            description_ro: 'Economic cu dormitoare și camere private.',
            amenities: 'Shared kitchen, common area, organized trips',
            amenities_ro: 'Bucătărie comună, sufragerie, excursii organizate',
            price: 'From €15/night',
            contact: '+40 268 234 570'
        },
        villa: {
            title: 'Villa Carpathia',
            title_ro: 'Villa Carpathia',
            description: 'Luxury villa with 5 bedrooms, private garden, outdoor pool, and jacuzzi.',
            description_ro: 'Vilă de lux cu 5 dormitoare, grădină privată, piscină în aer liber și jacuzzi.',
            amenities: 'Private pool, garden, BBQ area, full kitchen, parking',
            amenities_ro: 'Piscină privată, grădină, zonă BBQ, bucătărie complet echipată, parcare',
            price: 'From €300/night (sleeps 10)',
            contact: '+40 268 234 571'
        },
        boutique: {
            title: 'Boutique Hotel Residence',
            title_ro: 'Boutique Hotel Residence',
            description: 'Contemporary 4-star boutique hotel with rooftop bar and fitness center.',
            description_ro: 'Hotel boutique contemporan de 4 stele cu bar pe acoperiș și centru de fitness.',
            amenities: 'Rooftop bar, gym, restaurant, spa treatments, free WiFi',
            amenities_ro: 'Bar pe acoperiș, sală de sport, restaurant, tratamente spa, WiFi gratuit',
            price: 'From €90/night',
            contact: '+40 268 234 572'
        },
        cabins: {
            title: 'Mountain Cabins',
            title_ro: 'Căsuțe Montane',
            description: 'Rustic wooden cabins with modern amenities. Each with fireplace and private terrace.',
            description_ro: 'Căsuțe din lemn rustic cu facilități moderne. Fiecare cu șemineu și terasă privată.',
            amenities: 'Fireplace, terrace, kitchenette, WiFi',
            amenities_ro: 'Șemineu, terasă, bucătărie mică, WiFi',
            price: 'From €60/night (2 persons)',
            contact: '+40 268 234 573'
        },
        'casa-maria': {
            title: 'Casa Maria B&B',
            title_ro: 'Casa Maria B&B',
            description: 'Traditional bed and breakfast run by local family. Authentic experience with homemade meals.',
            description_ro: 'Pensiune tradițională de mic dejun și masă administrată de o familie locală. Experiență autentică cu mâncăruri de casă.',
            amenities: 'Breakfast included, shared lounge, garden, WiFi',
            amenities_ro: 'Mic dejun inclus, sufragerie comună, grădină, WiFi',
            price: 'From €35/night',
            contact: '+40 268 234 574'
        }
    };
    
    const detail = details[accommodationId];
    if (detail) {
        const title = (currentLang === 'ro' && detail.title_ro) ? detail.title_ro : detail.title;
        const description = (currentLang === 'ro' && detail.description_ro) ? detail.description_ro : detail.description;
        const amenities = (currentLang === 'ro' && detail.amenities_ro) ? detail.amenities_ro : detail.amenities;

        document.getElementById('details-title').textContent = title;
        document.getElementById('details-content').innerHTML = `
            <p><strong>${currentLang === 'ro' ? 'Descriere' : 'Description'}:</strong> ${description}</p>
            <p><strong>${currentLang === 'ro' ? 'Facilități' : 'Amenities'}:</strong> ${amenities}</p>
            <p><strong>${currentLang === 'ro' ? 'Preț' : 'Price'}:</strong> ${detail.price}</p>
            <p><strong>${currentLang === 'ro' ? 'Contact' : 'Book'}:</strong> ${detail.contact}</p>
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
        const title = translateMessage('Interactive map showing all locations, restaurants, and accommodations');
        const locationsLabel = translateMessage('📍 Locations');
        const restaurantsLabel = translateMessage('🍽️ Restaurants');
        const accommodationsLabel = translateMessage('🏨 Accommodations');
        const infoLine = translateMessage('In production, this displays a fully interactive map powered by OpenStreetMap/Leaflet');

        mapDiv.innerHTML = `
            <div id="map-fallback" style="width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 2rem; color: white; border-radius: 12px;">
                <i class="fas fa-map-marked-alt" style="font-size: 5rem; margin-bottom: 2rem; opacity: 0.9;"></i>
                <h3 style="color: white; margin-bottom: 1.5rem; font-size: 1.8rem;">${translateMessage('Interactive Map')}</h3>
                <p style="color: rgba(255,255,255,0.9); text-align: center; margin-bottom: 2rem; max-width: 600px;">
                    ${title}
                </p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 2rem; width: 100%; max-width: 900px;">
                    <div style="background: rgba(255,255,255,0.95); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: #333;">
                        <strong style="color: #2c5f8d; font-size: 1.1rem; display: block; margin-bottom: 0.5rem;">${locationsLabel}</strong>
                        <small style="color: #666;">Rasnov Fortress, Dino Parc, Piatra Mica Peak, Village Museum, Bran Castle, Poiana Brasov, Brasov Old Town, Peles Castle, National Park, Bear Sanctuary</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.95); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: #333;">
                        <strong style="color: #e8734e; font-size: 1.1rem; display: block; margin-bottom: 0.5rem;">${restaurantsLabel}</strong>
                        <small style="color: #666;">Cetate Restaurant, La Ceaun, Pizzeria Castello, Cafe Central, Belvedere Terrace, Grill House, Bistro Rasnoveana, Vegetarian Haven</small>
                    </div>
                    <div style="background: rgba(255,255,255,0.95); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: #333;">
                        <strong style="color: #4caf50; font-size: 1.1rem; display: block; margin-bottom: 0.5rem;">${accommodationsLabel}</strong>
                        <small style="color: #666;">Hotel Ambient, Pension Belvedere, Casa Petre, Mountain Hostel, Villa Carpathia, Boutique Hotel Residence, Mountain Cabins, Casa Maria B&B</small>
                    </div>
                </div>
                <p style="margin-top: 2rem; color: rgba(255,255,255,0.7); font-size: 0.95rem; text-align: center;">
                    <i class="fas fa-info-circle"></i> ${infoLine}
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
let currentLang = 'en';

// Minimal set of translations for Romanian
const I18N = {
    ro: {
        htmlLang: 'ro',
        logo: 'Descoperă Râșnov',
        nav: {
            '#home': 'Acasă',
            '#ar-mode': 'Vânătoare AR',
            '#map': 'Hartă',
            '#info': 'Info'
        },
        heroTitle: 'Bun venit în Râșnov',
        heroSubtitle: 'Explorați Cetatea istorică, natura uimitoare și cultura românească',
        heroCta: 'Începe Explorarea',
        tabs: {
            locations: 'Locații',
            restaurants: 'Restaurante',
            accommodations: 'Cazare'
        },
        ar: {
            title: 'Vânătoare AR',
            subtitle: 'Explorează Râșnov într-un mod distractiv și interactiv!',
            startHunt: '<i class="fas fa-play"></i> Începe Vânătoarea',
            scanQr: '<i class="fas fa-qrcode"></i> Scanează QR',
            useLocation: '<i class="fas fa-map-marker-alt"></i> Folosește Locația',
            testLocation: '<i class="fas fa-camera"></i> Testează Locație',
            testingMode: '<i class="fas fa-flask"></i> Mod Testare'
        },
        progressText: 'locații găsite',
        qrModalTitle: 'Scanează codul QR',
        qrHelp: 'Îndreptați camera către un cod QR la una dintre locațiile vânătorii',
        mapCta: 'Încarcă Harta',
        discoveryContinue: 'Continuă Vânătoarea',
        footer: {
            about: 'Despre Râșnov',
            quickLinks: 'Linkuri rapide',
            contact: 'Contact'
        },
        huntItems: {
            fortress: 'Poarta Cetății Râșnov',
            well: 'Fântâna Antică',
            tower: 'Turnul de Veghe',
            church: 'Biserica Veche',
            museum: 'Muzeul Satului',
            peak: 'Vârful Muntelui',
            square: 'Piața Orașului',
            dino: 'Intrarea Dino Parc'
        },
        infoCards: {
            emergency: {
                title: 'Urgență',
                police: 'Poliție',
                medical: 'Medical',
                touristInfo: 'Info Turist'
            },
            transportation: {
                title: 'Transport',
                busToBrasov: 'Autobuz la Brașov',
                taxi: 'Taxi',
                carRental: 'Închiriere Mașini'
            },
            language: {
                title: 'Limbă',
                main: 'Principal',
                common: 'Obișnuit',
                tip: 'Sfat'
            },
            currency: {
                title: 'Valută',
                currency: 'Valută',
                atms: 'Bancomate',
                cards: 'Cărți'
            },
            hours: {
                title: 'Ore de Deschidere',
                fortress: 'Cetate',
                shops: 'Magazine',
                restaurants: 'Restaurante'
            },
            visitTime: {
                title: 'Cel mai Bun Timp pentru Vizită',
                peak: 'Vârf',
                shoulder: 'Transițional',
                winter: 'Iarnă'
            }
        }
    }
};

// Message mapping for simple substring replacement translations
const MESSAGE_MAP = {
    ro: {
        'Please start the hunt first!': 'Vă rugăm să porniți vânătoarea mai întâi!',
        'Getting your location...': 'Se obține locația dvs...',
        'Could not get your location. Please enable location services.': 'Nu s-a putut obține locația. Activați serviciile de localizare.',
        'Geolocation is not supported by your browser.': 'Geolocalizarea nu este acceptată de browserul dvs.',
        'Testing mode enabled! Click on any location to mark it as found.': 'Mod testare activat! Apăsați pe orice locație pentru a o marca ca găsită.',
        'Testing mode disabled.': 'Mod testare dezactivat.',
        'Camera access is not supported on this browser. Please use a modern browser with HTTPS.': 'Accesul la cameră nu este acceptat de acest browser. Folosiți un browser modern cu HTTPS.',
        'Could not access camera. Testing mode allows manual selection.': 'Nu se poate accesa camera. Modul testare permite selecție manuală.',
        'QR Code scanned successfully!': 'Cod QR scanat cu succes!',
        'You already found this location!': 'Ai găsit deja această locație!',
        "QR code not recognized. Make sure you\'re at a scavenger hunt location.": 'Cod QR nerecunoscut. Asigurați-vă că sunteți la o locație a vânătorii.',
        'No locations nearby. Keep exploring!': 'Nicio locație în apropiere. Continuați explorarea!',
        'Unable to access camera. ': 'Imposibil de accesat camera. ',
        'Please allow camera access to use AR features.': 'Permiteți accesul la cameră pentru a folosi funcțiile AR.',
        'No camera found on this device.': 'Nu s-a găsit nicio cameră pe acest dispozitiv.',
        'Camera not supported on this browser. Please use HTTPS.': 'Camera nu este acceptată de acest browser. Folosiți HTTPS.',
        'Please check your camera settings.': 'Verificați setările camerei.',
        'AR camera requires HTTPS. Please access the site via https:// to use AR features.': 'Camera AR necesită HTTPS. Accesați site-ul prin https:// pentru a folosi funcțiile AR.',
        'Map loaded with all locations!': 'Harta încărcată cu toate locațiile!',
        'Map loaded successfully!': 'Harta a fost încărcată cu succes!',
        'Select a QR Code to Scan:': 'Selectați un cod QR pentru scanare:',
        'Initializing AR Camera...': 'Se inițializează camera AR...',
        'Scavenger hunt started! Find all 8 locations.': 'Vânătoarea a început! Găsiți toate cele 8 locații.',
        'Scavenger hunt stopped.': 'Vânătoarea a fost oprită.',
        'Testing AR at ': 'Testare AR la ',
        'Interactive map showing all locations, restaurants, and accommodations': 'Hartă interactivă care afișează toate locațiile, restaurantele și cazări',
        'Open now': 'Deschis acum',
        '❌ Closed': '❌ Închis',
        '✅ Open now': '✅ Deschis acum'
    }
};

function translateMessage(message) {
    if (!message || currentLang === 'en') return message;
    const map = MESSAGE_MAP[currentLang];
    if (!map) return message;

    // Replace known substrings to support dynamic messages
    let out = String(message);
    // Sort keys by length desc to avoid partial overlaps
    Object.keys(map).sort((a,b) => b.length - a.length).forEach(key => {
        if (out.indexOf(key) !== -1) {
            out = out.split(key).join(map[key]);
        }
    });
    return out;
}

function applyTranslations(lang) {
    const dict = I18N[lang];
    if (!dict) return;

    // set html lang
    document.documentElement.lang = dict.htmlLang || lang;

    // Logo
    const logoH1 = document.querySelector('.logo h1');
    if (logoH1) logoH1.textContent = dict.logo;

    // Nav links
    Object.entries(dict.nav).forEach(([href, text]) => {
        const a = document.querySelector(`.nav-list a[href="${href}"]`);
        if (a) a.textContent = text;
    });

    // Hero
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) heroTitle.textContent = dict.heroTitle;
    const heroSubtitle = document.querySelector('.hero-subtitle');
    if (heroSubtitle) heroSubtitle.textContent = dict.heroSubtitle;
    const heroCta = document.querySelector('.hero .cta-button');
    if (heroCta) heroCta.innerHTML = `<i class="fas fa-compass"></i> ${dict.heroCta}`;

    // Tabs
    tabButtons.forEach(btn => {
        const key = btn.dataset.tab;
        const span = btn.querySelector('span');
        if (span && dict.tabs[key]) span.textContent = dict.tabs[key];
    });

    // Section titles - common replacements
    const sectionMap = {
        'Top Locations to Visit': 'Cele mai bune locații de vizitat',
        'Best Restaurants': 'Cele mai bune restaurante',
        'Places to Stay': 'Locuri de cazare',
        'AR Scavenger Hunt': dict.ar.title,
        'Interactive Map': 'Hartă Interactivă',
        'Essential Information': 'Informații esențiale',
        'Your Progress': 'Progresul tău'
    };
    document.querySelectorAll('.section-title, .section-header h2, .progress-container h3').forEach(el => {
        const txt = el.textContent.trim();
        if (sectionMap[txt]) el.textContent = sectionMap[txt];
    });

    // AR buttons
    if (startHuntBtn) startHuntBtn.innerHTML = dict.ar.startHunt;
    if (scanQrBtn) scanQrBtn.innerHTML = dict.ar.scanQr;
    if (useLocationBtn) useLocationBtn.innerHTML = dict.ar.useLocation;
    if (testLocationBtn) testLocationBtn.innerHTML = dict.ar.testLocation;
    if (testingModeBtn) testingModeBtn.innerHTML = dict.ar.testingMode;

    // Hunt items
    if (dict.huntItems) {
        Object.entries(dict.huntItems).forEach(([key, label]) => {
            const huntItem = document.querySelector(`.hunt-item[data-location="${key}"] span`);
            if (huntItem) huntItem.textContent = label;
        });
    }

    // Progress text suffix
    const progressText = document.querySelector('.progress-text');
    if (progressText) {
        const count = document.getElementById('progress-count').textContent;
        const total = document.getElementById('progress-total').textContent;
        progressText.innerHTML = `<span id="progress-count">${count}</span> / <span id="progress-total">${total}</span> ${dict.progressText}`;
    }

    // QR modal
    const qrModalH3 = document.querySelector('#qr-modal h3');
    if (qrModalH3) qrModalH3.textContent = dict.qrModalTitle;
    const qrHelp = document.querySelector('#qr-modal .help-text');
    if (qrHelp) qrHelp.textContent = dict.qrHelp;

    // AR loading text
    const arLoadingP = document.querySelector('#ar-loading p');
    if (arLoadingP) arLoadingP.textContent = translateMessage('Initializing AR Camera...');

    // Map CTA
    const mapCtaBtn = document.querySelector('#interactive-map .cta-button');
    if (mapCtaBtn) mapCtaBtn.textContent = dict.mapCta;

    // Discovery modal continue button
    const discoveryContinueBtn = document.querySelector('#discovery-modal .cta-button');
    if (discoveryContinueBtn) discoveryContinueBtn.textContent = dict.discoveryContinue;

    // Footer headings
    const footerAbout = document.querySelector('.footer-section:first-child h4');
    if (footerAbout) footerAbout.textContent = dict.footer.about;
    const footerQuick = document.querySelectorAll('.footer-section h4')[1];
    if (footerQuick) footerQuick.textContent = dict.footer.quickLinks;
    const footerContact = document.querySelectorAll('.footer-section h4')[2];
    if (footerContact) footerContact.textContent = dict.footer.contact;

    // Translate footer about text
    const footerAboutText = document.querySelector('.footer-section:first-child p');
    if (footerAboutText && currentLang === 'ro') {
        footerAboutText.textContent = 'Oraș istoric din Transilvania, România, cunoscut pentru forța medievală și peisajele muntoase impresionante.';
    } else if (footerAboutText && currentLang === 'en') {
        footerAboutText.textContent = 'Historic town in Transylvania, Romania, known for its medieval fortress and stunning mountain scenery.';
    }

    // Translate footer links
    const footerLinks = document.querySelectorAll('.footer-section:nth-child(2) a');
    const linkTranslations = {
        en: ['Home', 'Scavenger Hunt', 'Map', 'Info'],
        ro: ['Acasă', 'Vânătoare', 'Hartă', 'Info']
    };
    footerLinks.forEach((link, idx) => {
        if (linkTranslations[currentLang] && linkTranslations[currentLang][idx]) {
            link.textContent = linkTranslations[currentLang][idx];
        }
    });

    // Translate card titles/descriptions by scanning buttons that open details
    // Locations
    document.querySelectorAll('button[onclick^="showLocationDetails("]').forEach(btn => {
        const m = btn.getAttribute('onclick').match(/showLocationDetails\('([^']+)'\)/);
        if (!m) return;
        const key = m[1];
        const card = btn.closest('.card');
        if (!card) return;

        // Attempt to use details translations defined in showLocationDetails
        // We'll construct simple translation map here to avoid moving existing objects
        const detailsMap = {
            fortress: {
                en: { title: 'Rasnov Fortress', desc: 'A medieval citadel built by Teutonic Knights in the 13th century. Offers breathtaking panoramic views of the surrounding Carpathian Mountains.' },
                ro: { title: 'Cetatea Râșnov', desc: 'O cetate medievală construită de Cavalerii Teutoni în secolul al XIII-lea. Oferă priveliști panoramice impresionante ale Munților Carpați.' }
            },
            dinoparc: {
                en: { title: 'Dino Parc', desc: 'The largest dinosaur park in Southeast Europe with life-size animatronic dinosaurs. Perfect for families and children.' },
                ro: { title: 'Dino Parc', desc: 'Cel mai mare parc cu dinozauri din Europa de Sud-Est, ideal pentru familii și copii.' }
            },
            peak: {
                en: { title: 'Piatra Mica Peak', desc: 'Hiking trail to a stunning mountain peak. Accessible via cable car or hiking trail, offering spectacular mountain views.' },
                ro: { title: 'Piatra Mică', desc: 'Traseu de drumeție către un vârf montan impresionant. Accesibil cu telescaunul sau pe traseu.' }
            },
            museum: {
                en: { title: 'Village Museum', desc: 'Explore traditional Romanian rural life with authentic houses, tools, and artifacts from the region\'s history.' },
                ro: { title: 'Muzeul Satului', desc: 'Explorează viața rurală tradițională românească cu case autentice, unelte și artefacte.' }
            },
            bran: {
                en: { title: 'Bran Castle', desc: 'Famous Dracula\'s Castle, just 15 minutes away. Gothic fortress with fascinating history and stunning architecture.' },
                ro: { title: 'Castelul Bran', desc: 'Faimosul Castel al lui Dracula, la doar 15 minute. Fortăreață gotică cu o istorie fascinantă.' }
            },
            poiana: {
                en: { title: 'Poiana Brasov Ski Resort', desc: 'Premier ski resort nearby with 23km of slopes. Great for winter sports enthusiasts and summer hiking.' },
                ro: { title: 'Stațiunea Poiana Brașov', desc: 'Stațiune de schi cu 23 km de pârtii. Excelentă pentru sporturi de iarnă și drumeții de vară.' }
            },
            brasov: {
                en: { title: 'Brasov Old Town', desc: 'Medieval city center with Council Square, Black Church, and charming cobblestone streets.' },
                ro: { title: 'Centrul Istoric Brașov', desc: 'Centru medieval cu Piața Sfatului, Biserica Neagră și străzi pietruite pitorești.' }
            },
            peles: {
                en: { title: 'Peles Castle', desc: 'Neo-Renaissance masterpiece in Sinaia. One of Europe\'s most beautiful castles with 160 lavishly decorated rooms.' },
                ro: { title: 'Castelul Peleș', desc: 'Capodoperă neo-renascentistă din Sinaia. Unul dintre cele mai frumoase castele din Europa.' }
            },
            'national-park': {
                en: { title: 'Piatra Craiului National Park', desc: 'Protected natural area with dramatic limestone ridge. Excellent hiking, wildlife watching, and pristine nature.' },
                ro: { title: 'Parcul Național Piatra Craiului', desc: 'Areal natural protejat cu creastă calcaroasă dramatică. Potrivit pentru drumeții și observarea faunei.' }
            },
            'bear-sanctuary': {
                en: { title: 'Libearty Bear Sanctuary', desc: 'Europe\'s largest brown bear sanctuary. Home to rescued bears in natural habitat. Educational and ethical tourism.' },
                ro: { title: 'Sanctuarul pentru Urși Libearty', desc: 'Cel mai mare sanctuar pentru urși bruni din Europa. Urși salvați trăind în habitat natural.' }
            }
        };

        const mapEntry = detailsMap[key];
        if (mapEntry) {
            const titleEl = card.querySelector('.card-title');
            const descEl = card.querySelector('.card-description');
            if (titleEl) titleEl.textContent = (currentLang === 'ro') ? mapEntry.ro.title : mapEntry.en.title;
            if (descEl) descEl.textContent = (currentLang === 'ro') ? mapEntry.ro.desc : mapEntry.en.desc;
        }
    });

    // Restaurants
    document.querySelectorAll('button[onclick^="showRestaurantDetails("]').forEach(btn => {
        const m = btn.getAttribute('onclick').match(/showRestaurantDetails\('([^']+)'\)/);
        if (!m) return;
        const key = m[1];
        const card = btn.closest('.card');
        if (!card) return;
        const restMap = {
            cetate: { en: { title: 'Cetate Restaurant', desc: 'Traditional Romanian cuisine in the heart of the fortress.' }, ro: { title: 'Restaurant Cetate', desc: 'Bucătărie tradițională românească în inima cetății.' } },
            ceaun: { en: { title: 'La Ceaun', desc: 'Cozy tavern serving hearty mountain dishes.' }, ro: { title: 'La Ceaun', desc: 'Han primitor cu mâncăruri montane consistente.' } },
            pizzeria: { en: { title: 'Pizzeria Castello', desc: 'Italian pizzeria with a Romanian twist.' }, ro: { title: 'Pizzeria Castello', desc: 'Pizzerie italiană cu influențe românești.' } },
            cafe: { en: { title: 'Cafe Central', desc: 'Modern cafe with excellent coffee, pastries, and light meals.' }, ro: { title: 'Cafe Central', desc: 'Cafenea modernă cu cafea excelentă și patiserie.' } },
            'belvedere-terrace': { en: { title: 'Belvedere Terrace', desc: 'Restaurant with panoramic terrace and international cuisine.' }, ro: { title: 'Terasă Belvedere', desc: 'Restaurant cu terasă panoramică și bucătărie internațională.' } },
            'grill-house': { en: { title: 'Grill House Rasnov', desc: 'BBQ specialist with outdoor grill.' }, ro: { title: 'Grill House Rasnov', desc: 'Specialist în BBQ cu grătar în aer liber.' } },
            bistro: { en: { title: 'Bistro Rasnoveana', desc: 'Casual bistro in town center.' }, ro: { title: 'Bistro Rasnoveana', desc: 'Bistro casual în centrul orașului.' } },
            vegetarian: { en: { title: 'Vegetarian Haven', desc: 'Plant-based restaurant with creative dishes.' }, ro: { title: 'Vegetarian Haven', desc: 'Restaurant pe bază de plante cu preparate creative.' } }
        };
        const entry = restMap[key];
        if (entry) {
            const titleEl = card.querySelector('.card-title');
            const descEl = card.querySelector('.card-description');
            if (titleEl) titleEl.textContent = (currentLang === 'ro') ? entry.ro.title : entry.en.title;
            if (descEl) descEl.textContent = (currentLang === 'ro') ? entry.ro.desc : entry.en.desc;
        }
    });

    // Accommodations
    document.querySelectorAll('button[onclick^="showAccommodationDetails("]').forEach(btn => {
        const m = btn.getAttribute('onclick').match(/showAccommodationDetails\('([^']+)'\)/);
        if (!m) return;
        const key = m[1];
        const card = btn.closest('.card');
        if (!card) return;
        const accMap = {
            ambient: { en: { title: 'Hotel Ambient', desc: 'Modern 4-star hotel with spa facilities, mountain views.' }, ro: { title: 'Hotel Ambient', desc: 'Hotel modern de 4 stele cu spa și vedere la munte.' } },
            belvedere: { en: { title: 'Pension Belvedere', desc: 'Family-run guesthouse with traditional hospitality.' }, ro: { title: 'Pensiunea Belvedere', desc: 'Pensiune de familie cu ospitalitate tradițională.' } },
            petre: { en: { title: 'Casa Petre', desc: 'Charming apartments in the old town.' }, ro: { title: 'Casa Petre', desc: 'Apartamente fermecătoare în centrul vechi.' } },
            hostel: { en: { title: 'Mountain Hostel', desc: 'Budget-friendly hostel perfect for backpackers.' }, ro: { title: 'Hostel Montan', desc: 'Hostel economic, ideal pentru backpackeri.' } },
            villa: { en: { title: 'Villa Carpathia', desc: 'Luxury villa with private garden and pool.' }, ro: { title: 'Villa Carpathia', desc: 'Vilă de lux cu grădină privată și piscină.' } },
            boutique: { en: { title: 'Boutique Hotel Residence', desc: 'Stylish boutique hotel with modern amenities.' }, ro: { title: 'Boutique Hotel Residence', desc: 'Hotel boutique stilat cu facilități moderne.' } },
            cabins: { en: { title: 'Mountain Cabins', desc: 'Cozy wooden cabins in nature.' }, ro: { title: 'Căsuțe Montane', desc: 'Căsuțe din lemn, confortabile, în natură.' } },
            'casa-maria': { en: { title: 'Casa Maria B&B', desc: 'Traditional bed and breakfast with local charm.' }, ro: { title: 'Casa Maria B&B', desc: 'Pensiune tradițională cu farmec local.' } }
        };
        const entry = accMap[key];
        if (entry) {
            const titleEl = card.querySelector('.card-title');
            const descEl = card.querySelector('.card-description');
            if (titleEl) titleEl.textContent = (currentLang === 'ro') ? entry.ro.title : entry.en.title;
            if (descEl) descEl.textContent = (currentLang === 'ro') ? entry.ro.desc : entry.en.desc;
        }
    });

    // Translate info cards
    if (dict.infoCards) {
        const infoCardsMap = {
            'Emergency': dict.infoCards.emergency.title,
            'Transportation': dict.infoCards.transportation.title,
            'Language': dict.infoCards.language.title,
            'Currency': dict.infoCards.currency.title,
            'Opening Hours': dict.infoCards.hours.title,
            'Best Time to Visit': dict.infoCards.visitTime.title
        };
        
        // Translate info card titles
        document.querySelectorAll('.info-card h3').forEach(el => {
            const title = el.textContent.trim();
            if (infoCardsMap[title]) {
                el.textContent = infoCardsMap[title];
            }
        });

        // Translate info card content
        document.querySelectorAll('.info-card p').forEach((p) => {
            const text = p.innerHTML;
            // Emergency section
            if (text.includes('<strong>Police')) {
                p.innerHTML = `<strong>${dict.infoCards.emergency.police}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Medical')) {
                p.innerHTML = `<strong>${dict.infoCards.emergency.medical}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Tourist Info')) {
                p.innerHTML = `<strong>${dict.infoCards.emergency.touristInfo}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            }
            // Transportation section
            else if (text.includes('<strong>Bus to Brasov')) {
                p.innerHTML = `<strong>${dict.infoCards.transportation.busToBrasov}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Taxi')) {
                p.innerHTML = `<strong>${dict.infoCards.transportation.taxi}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Car Rental')) {
                p.innerHTML = `<strong>${dict.infoCards.transportation.carRental}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            }
            // Language section
            else if (text.includes('<strong>Main')) {
                p.innerHTML = `<strong>${dict.infoCards.language.main}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Common')) {
                p.innerHTML = `<strong>${dict.infoCards.language.common}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Tip')) {
                p.innerHTML = `<strong>${dict.infoCards.language.tip}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            }
            // Currency section
            else if (text.includes('<strong>Currency')) {
                p.innerHTML = `<strong>${dict.infoCards.currency.currency}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>ATMs')) {
                p.innerHTML = `<strong>${dict.infoCards.currency.atms}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Cards')) {
                p.innerHTML = `<strong>${dict.infoCards.currency.cards}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            }
            // Opening Hours section
            else if (text.includes('<strong>Fortress')) {
                p.innerHTML = `<strong>${dict.infoCards.hours.fortress}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Shops')) {
                p.innerHTML = `<strong>${dict.infoCards.hours.shops}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Restaurants')) {
                p.innerHTML = `<strong>${dict.infoCards.hours.restaurants}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            }
            // Best Time section
            else if (text.includes('<strong>Peak')) {
                p.innerHTML = `<strong>${dict.infoCards.visitTime.peak}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Shoulder')) {
                p.innerHTML = `<strong>${dict.infoCards.visitTime.shoulder}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            } else if (text.includes('<strong>Winter')) {
                p.innerHTML = `<strong>${dict.infoCards.visitTime.winter}:</strong> ${p.innerHTML.match(/<\/strong>(.+)$/)[1]}`;
            }
        });
    }
}

if (langToggle) {
    langToggle.addEventListener('click', () => {
        if (currentLang === 'en') {
            currentLang = 'ro';
            langToggle.innerHTML = '<i class="fas fa-globe"></i> RO';
            applyTranslations('ro');
            showNotification('Limba a fost schimbată în Română', 'info');
        } else {
            currentLang = 'en';
            langToggle.innerHTML = '<i class="fas fa-globe"></i> EN';
            // For now, reload to restore original English texts (simple revert)
            // Alternatively we could store English strings and reapply them.
            window.location.reload();
            showNotification('Language changed to English', 'info');
        }
    });
}

// ==================== Initialization ====================

// Initialize user account system
initializeUser();

// Initialize button states (before restoreHuntState which may re-enable them)
scanQrBtn.disabled = true;
useLocationBtn.disabled = true;

// Restore hunt state (found locations, photos, button states) from saved data
restoreHuntState();

// Initialize progress display
updateProgress();

// Add smooth scroll behavior
document.documentElement.style.scrollBehavior = 'smooth';

console.log('Discover Rasnov - Tourist Website Initialized');
console.log('Testing mode available for AR scavenger hunt');
console.log('User Points System Active - Points saved to account');
