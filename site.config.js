// ============================================================
// site.config.js — Site configuration for Discover Rasnov
// ============================================================
// Edit the values below to configure the site.
// No coding knowledge is required — just change the text inside the quotes.
// ============================================================

module.exports = {

  // The public URL where this site is deployed.
  // QR codes will encode links to this domain, and the QR scanner
  // will expect codes that start with this URL.
  SITE_DOMAIN: 'https://rasnov-site.onrender.com',

  // ---------- Storage Settings ----------

  // Where to persist data files and photos across deploys.
  // Options: 'cloudinary' (default) or 'local'
  //   - 'cloudinary' : uses Cloudinary cloud storage (requires CLOUDINARY_URL env var)
  //   - 'local'      : uses a folder on the server's filesystem
  STORAGE_MODE: 'cloudinary',

  // Path to the local storage folder (only used when STORAGE_MODE is 'local').
  // An absolute path lets you place the folder outside the project directory so
  // that git pulls / redeploys won't delete existing data.
  // A relative path is resolved from the project root.
  // Default: './local-storage'  (a folder inside the project directory)
  LOCAL_STORAGE_PATH: './local-storage',

};

/* How to Edit/Add/Remove locations for the treasure hunt.
// Step 1: Open the tab called data
// Step 2: Open the file called scavenger-data.json
// Step 3: Copy and paste the following code on a new line after the second curly bracket at the end of the file to add a new location. Make sure to change the values for each field.

"title": {
  "name": "location_en",
  "name_ro": "location_ro",
  "qr": "qr_name",
  "difficulty": difficulty_value,
  "lat": latitude_value,
  "lng": longitude_value,
  "hint": "Congratulations! You found the (location_en) next look for the (next_location_en)!",
  "hint_ro": "Felicitări! Ai găsit (location_ro), apoi caută (next_location_ro)!",
  "quiz": {
    "question": "question_text",
    "answer": "answer_text",
    "options": ["answer_text", "option_text2", "option_text3", "option_text4"]
  }
}

Step 4: Replace the following fields in the code above with your own values:

title -> location's name in code
location_en -> location's name in english
location_ro -> location's name in romanian
qr_name -> name of qr code in all caps 
difficulty_value -> enter either 0 for easy or 2 for hard
latitude_value -> enter the latitude of the location for the map pin to use
longitude_value -> enter the longitude of the location for the map pin to use
next_location_en -> name of the next location in english to be used in the hint
next_location_ro -> name of the next location in romanian to be used in the hint
question_text -> make a question based on the plaque this location's qr code is found on.
answer_text -> write the answer to the question you just made
option_text2 -> write the second option for the quiz question
option_text3 -> write the third option for the quiz question
option_text4 -> write the fourth option for the quiz question

Step 5: Add the title into the correct spot in the order
Congrats you have successfully added a new location to the treasure hunt! Repeat these steps to add as many locations as you want.
*/


