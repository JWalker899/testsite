# Feature List

A summary of every feature in the Rasnov tourist site, compiled from the full commit and PR history.

## Website & Deployment

- Rasnov tourist website with location cards for attractions, restaurants, and accommodations
- Node.js / Express server with deployment support for Render
- Custom Rasnov coat-of-arms favicon
- Custom local background banner image
- Site configuration file (`site.config.js`) for centralized settings
- Configurable data storage: Cloudinary cloud storage or local filesystem (with migration script)

## Interactive Map

- Interactive map powered by Leaflet with markers for all tourist locations
- Map auto-loads on page load
- Treasure hunt location markers shown on the map with difficulty indicators and found/unfound states
- Hunt progress counter displayed on the map (e.g. "3/18 found")
- Zoom and pan bounded to Romania region
- 3 km search radius with distance-based filtering of places on startup

## Treasure Hunt (Scavenger Hunt)

- QR code–based treasure hunt across Rasnov locations
- Separate dedicated hunt page (`hunt.html`)
- URL-based QR codes that link directly to each location
- Circular hunt order so every participant starts at a different location
- Welcome popup on first visit explaining the treasure hunt
- Hunt items rendered dynamically from `scavenger-data.json` with localized names
- Scavenger hunt data stored in a dedicated JSON file (`scavenger-data.json`)
- Quiz modal at each location with location-specific questions
- Points awarded for scanning QR codes and answering quiz questions
- After completing all main locations, the hunt stays active and prompts for bonus locations
- Bonus QR code locations beyond the main route
- Timer tracking elapsed time from first scan to last scan
- `/qrcodes` debug page listing all QR codes and coordinates

## Photo Capture & Collage

- Photo capture triggered after scanning a QR code
- Selfie (front-facing) camera used by default with silent fallback to rear camera
- Camera permission prompt when camera access is blocked
- Rewards collage built from captured photos in a hexagonal tiling layout
- Collage style switcher (multiple visual styles)
- Collage download as image and native share support
- Silver and gold border tiers on collage based on hunt completion

## User Accounts & Leaderboard

- User identity via UUID with name prompt on first location find
- Points system with profile modal and point-earned notifications
- Leaderboard showing top 10 users, with the current user appended below if outside the top 10
- Leaderboard displays elapsed hunt time (first scan to last scan); gold highlight for finishers
- Leaderboard and user data persisted server-side (Cloudinary or local file)
- Desync recovery between local and server-side point totals
- Reset progress button with inline confirmation

## Rewards Tab

- Rewards tab (formerly "Unlocks") with three sections: themes, discounts, and photo collage
- Theme unlocks earned by progressing through the hunt
- Survey popup after finding 2nd location, completing the survey unlocks a 4th theme
- Discount section showing local partner offers

## AR Bear Hunt

- 3D Grizzly bear AR photo hunt experience
- Bear fake-out animation before the real capture moment
- WebXR immersive-AR mode with hit-test surface placement (Pokémon GO–style bear anchoring)
- Camera motion detection and compass-anchored AR positioning
- Demo placeholder shown when camera is unavailable

## Data & API

- Google Places API integration for fetching location data (name, photos, reviews, ratings)
- Romanian place names fetched via Place Details API alongside English names
- Build-time image caching to avoid per-visitor Google API billing
- 30-day smart cache with force-fetch option for place data
- Per-place photo reference tracking with `.ref` sidecar validation
- Cached photos reused during re-fetch to minimize API calls
- Locations sorted by review count
- Daily featured attraction highlight
- Places blacklist support to exclude unwanted results
- Orphaned photo cleanup on data re-fetch
- Real weather API integration for current conditions
- API endpoint to reset a user's hunt progress server-side

## Localization

- Full English and Romanian language support via i18next
- Language toggle button in the header
- All UI strings, hunt items, rewards, and map elements translated

## UI & Navigation

- Hamburger menu for mobile navigation
- Responsive header that collapses logo text and language label on small screens
- Cookie notice banner (info-only, no accept/deny)
- Social media links to official Rasnov pages (Facebook, Instagram)
- Accessible language toggle with aria-label showing current language
