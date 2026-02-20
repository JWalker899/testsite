const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Persistent leaderboard file
const LEADERBOARD_FILE = path.join(__dirname, 'data', 'leaderboard.json');

// Load persisted user accounts on startup (keyed by UUID)
let userAccounts = {};
try {
  if (fs.existsSync(LEADERBOARD_FILE)) {
    userAccounts = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
  }
} catch (e) {
  console.warn('Could not load leaderboard data, starting fresh:', e.message);
  userAccounts = {};
}

// Persist user accounts to disk (atomic write)
function saveLeaderboardData() {
  try {
    const dir = path.dirname(LEADERBOARD_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = LEADERBOARD_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(userAccounts, null, 2));
    try {
      fs.renameSync(tmp, LEADERBOARD_FILE);
    } catch (renameErr) {
      // Clean up temp file if rename failed, then re-throw
      try { fs.unlinkSync(tmp); } catch (_) {}
      throw renameErr;
    }
  } catch (e) {
    console.error('Failed to save leaderboard data:', e.message);
  }
}

// Validate UUID v4 format
function isValidUUID(str) {
  return typeof str === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// Sanitize display name
function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  return name.trim().substring(0, 30) || null;
}

// User points per location
const POINTS_PER_LOCATION = 10;
const COMPLETION_BONUS = 50;

// ==================== API Routes ====================

// Create or update user account (idempotent, keyed by UUID)
app.post('/api/user/create', (req, res) => {
  const { uuid, displayName } = req.body;

  if (!isValidUUID(uuid)) {
    return res.status(400).json({ error: 'Valid UUID v4 is required' });
  }

  if (userAccounts[uuid]) {
    // Update displayName only if not yet set
    if (displayName && !userAccounts[uuid].displayName) {
      userAccounts[uuid].displayName = sanitizeName(displayName);
      saveLeaderboardData();
    }
    return res.status(200).json(userAccounts[uuid]);
  }

  const newUser = {
    uuid,
    displayName: sanitizeName(displayName),
    totalPoints: 0,
    locationsFound: [],
    completedAt: null,
    createdAt: new Date().toISOString()
  };

  userAccounts[uuid] = newUser;
  saveLeaderboardData();
  res.status(201).json(newUser);
});

// Get user account by UUID
app.get('/api/user/:uuid', (req, res) => {
  const { uuid } = req.params;

  if (!isValidUUID(uuid)) {
    return res.status(400).json({ error: 'Invalid UUID format' });
  }

  const user = userAccounts[uuid];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

// Set or update display name for a user
app.post('/api/user/:uuid/set-name', (req, res) => {
  const { uuid } = req.params;
  const { displayName } = req.body;

  if (!isValidUUID(uuid)) {
    return res.status(400).json({ error: 'Invalid UUID format' });
  }

  const name = sanitizeName(displayName);
  if (!name) {
    return res.status(400).json({ error: 'A valid display name is required' });
  }

  if (!userAccounts[uuid]) {
    return res.status(404).json({ error: 'User not found' });
  }

  userAccounts[uuid].displayName = name;
  saveLeaderboardData();
  res.json(userAccounts[uuid]);
});

// Award points for finding a location
app.post('/api/user/:uuid/location-found', (req, res) => {
  const { uuid } = req.params;
  const { locationKey, locationName, isCompletion } = req.body;

  if (!isValidUUID(uuid)) {
    return res.status(400).json({ error: 'Invalid UUID format' });
  }

  if (!userAccounts[uuid]) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = userAccounts[uuid];

  // Prevent duplicate points for same location (idempotent)
  if (user.locationsFound.includes(locationKey)) {
    return res.status(400).json({
      error: 'Location already found',
      user: user
    });
  }

  // Add location to found list
  user.locationsFound.push(locationKey);

  // Award points
  const points = POINTS_PER_LOCATION;
  user.totalPoints += points;
  user.lastLocationAt = new Date().toISOString();

  // Award completion bonus if hunt is complete
  if (isCompletion) {
    user.totalPoints += COMPLETION_BONUS;
    user.completedAt = new Date().toISOString();
  }

  saveLeaderboardData();

  res.json({
    success: true,
    pointsAwarded: points,
    completionBonus: isCompletion ? COMPLETION_BONUS : 0,
    user: user
  });
});

// Get leaderboard (top 50 users who have made progress)
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = Object.values(userAccounts)
    .filter(u => u.totalPoints > 0 || u.locationsFound.length > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 50)
    .map((user, index) => ({
      rank: index + 1,
      uuid: user.uuid,
      username: user.displayName || `Explorer_${user.uuid.substring(0, 6)}`,
      totalPoints: user.totalPoints,
      locationsFound: user.locationsFound.length,
      completedAt: user.completedAt
    }));

  res.json(leaderboard);
});

// ==================== Static Routes ====================

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle all other routes by serving index.html (for single-page app behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Points system: ${POINTS_PER_LOCATION} points per location, ${COMPLETION_BONUS} point completion bonus`);
});
