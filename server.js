const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// In-memory storage for user accounts (in production, use a database)
const userAccounts = {};

// User points per location
const POINTS_PER_LOCATION = 10;
const COMPLETION_BONUS = 50;

// ==================== API Routes ====================

// Create or get user account
app.post('/api/user/create', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  if (userAccounts[username]) {
    return res.status(200).json(userAccounts[username]);
  }
  
  const newUser = {
    username,
    totalPoints: 0,
    locationsFound: [],
    completedAt: null,
    createdAt: new Date().toISOString()
  };
  
  userAccounts[username] = newUser;
  res.status(201).json(newUser);
});

// Get user account
app.get('/api/user/:username', (req, res) => {
  const { username } = req.params;
  const user = userAccounts[username];
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
});

// Award points for finding a location
app.post('/api/user/:username/location-found', (req, res) => {
  const { username } = req.params;
  const { locationKey, locationName, isCompletion } = req.body;
  
  if (!userAccounts[username]) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = userAccounts[username];
  
  // Prevent duplicate points for same location
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
  
  res.json({
    success: true,
    pointsAwarded: points,
    completionBonus: isCompletion ? COMPLETION_BONUS : 0,
    user: user
  });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = Object.values(userAccounts)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 10)
    .map((user, index) => ({
      rank: index + 1,
      username: user.username,
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
