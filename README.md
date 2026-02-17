# Discover Rasnov - Tourist Website

A polished, interactive tourist website for Rasnov, Romania, featuring an AR scavenger hunt and comprehensive visitor information.

## Features

### 🏠 Homepage with Tab Navigation
- **Locations to Visit**: Top attractions including Rasnov Fortress, Dino Parc, Piatra Mica Peak, and Village Museum
- **Restaurants**: Best dining options from traditional Romanian to modern cafes
- **Places to Stay**: Accommodation options from luxury hotels to budget hostels

### 📱 AR Scavenger Hunt
Interactive gamification to explore Rasnov:
- **QR Code Scanning**: Scan QR codes at 8 historical locations
- **Location Services**: Automatic discovery when near locations
- **Progress Tracking**: Visual progress bar showing completion (X/8 locations)
- **Educational Facts**: Learn interesting history about each discovered location
- **Testing Mode**: Easy testing without physical QR codes or location requirements

### 🌟 Additional Tourist Features
- **Interactive Map**: Shows all locations, restaurants, and accommodations
- **Weather Widget**: Real-time temperature display
- **Language Toggle**: Switch between English and Romanian
- **Essential Information**: Emergency contacts, transportation, currency, opening hours
- **Mobile Responsive**: Works perfectly on all devices

### 🎨 Polish & Design
- Modern, clean UI with smooth animations
- Gradient backgrounds and hover effects
- Card-based layout for easy browsing
- Notification system for user feedback
- Accessibility features (ARIA labels, keyboard navigation)

## How to Use

### Running Locally
1. Clone the repository
2. Open `index.html` in a web browser, or
3. Run a local server:
   ```bash
   python3 -m http.server 8000
   ```
4. Navigate to `http://localhost:8000`

### Using the AR Scavenger Hunt

#### For Testing (Recommended for Demo)
1. Click **"Testing Mode"** button (orange)
2. Click **"Start Hunt"** button
3. Click on any location name to mark it as "found"
4. View progress bar and fun facts

#### For Real Use with QR Codes
1. Print QR codes with these values at each location:
   - Fortress: `1`
   - Well: `2`
   - Tower: `3`
   - Church: `4`
   - Museum: `5`
   - Peak: `6`
   - Square: `7`
   - Dino: `8`
2. Click **"Start Hunt"**
3. Click **"Scan QR Code"** and allow camera access
4. Point camera at QR codes at each location

#### For Real Use with Location Services
1. Click **"Start Hunt"**
2. Click **"Use Location"** and allow location access
3. Visit the actual locations (within 100m)
4. Automatic discovery when nearby

## Technology Stack

- **HTML5**: Semantic markup with accessibility
- **CSS3**: Modern styling with animations and gradients
- **JavaScript (ES6+)**: Interactive features and state management
- **Font Awesome**: Icon library
- **Geolocation API**: Location-based discovery
- **Media Devices API**: Camera access for QR scanning

## File Structure

```
/
├── index.html      # Main HTML structure
├── styles.css      # All styling and animations
├── script.js       # Interactive functionality
└── README.md       # Documentation
```

## Scavenger Hunt Locations

The website tracks 8 key locations in Rasnov:

1. **Rasnov Fortress Gate** - Built in 1215 by Teutonic Knights
2. **Ancient Well** - 143-meter deep well dug by Turkish prisoners
3. **Watch Tower** - 360-degree views for enemy spotting
4. **Old Church** - Gothic church from 14th century
5. **Village Museum** - 300+ artifacts of Romanian village life
6. **Mountain Peak** - 1650m elevation with panoramic views
7. **Town Square** - 600+ year old gathering place
8. **Dino Park Entrance** - 100+ life-size dinosaur replicas

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Fully responsive

## Future Enhancements

- Integration with actual map APIs (Google Maps/OpenStreetMap)
- Real weather API integration
- Multi-language support (full translations)
- Backend for user accounts and saved progress
- Social sharing of completed hunts
- Leaderboards and achievements
- Audio guides for locations
- Virtual reality tour mode

## Credits

Created for tourists visiting Rasnov, Romania. Made with ❤️ for travelers.

## License

This project is open source and available for tourist information purposes.
