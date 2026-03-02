# Setup Guide - Google Places API Integration

This guide will help you set up the Google Places API integration for your Rasnov tourist website. This integration is **100% free** within the generous free tier limits provided by Google.

## Table of Contents
1. [Why This Approach is Free](#why-this-approach-is-free)
2. [Getting Google Places API Key](#getting-google-places-api-key)
3. [Getting Unsplash API Key (Optional)](#getting-unsplash-api-key-optional)
4. [Local Setup](#local-setup)
5. [One-Time Image Download](#one-time-image-download)
6. [GitHub Actions Setup](#github-actions-setup)
7. [Running the Data Fetch](#running-the-data-fetch)
8. [Troubleshooting](#troubleshooting)
9. [API Usage and Costs](#api-usage-and-costs)

---

## Why This Approach is Free

This implementation uses **build-time data fetching** instead of runtime API calls:

- ✅ **Build-time**: Fetch data once, save to JSON, deploy static site
- ❌ **Runtime**: Every visitor triggers API calls (expensive!)

By fetching data at build time (weekly via GitHub Actions), you stay well within Google's free tier:
- **Google Places API Free Tier**: $200/month credit = ~28,000 API calls/month
- **Our Weekly Usage**: ~60-100 API calls/week = ~400/month
- **Result**: 100% FREE! 🎉

> ⚠️ **Important – Google Photo URLs are Billable Per Request**
>
> The Google Places Photo API charges for every HTTP request, including ones made by website
> visitors' browsers. Embedding raw `maps.googleapis.com/maps/api/place/photo?...` URLs directly
> in the generated JSON means **every page load bills your Google Cloud account** – not just the
> data fetch. With many visitors this can exhaust the free-tier credit quickly.
>
> The solution is to download photo bytes **once at build time**, save them to
> `assets/place-photos/`, and write local paths (e.g. `/assets/place-photos/ChIJ…_0.jpg`) into
> `places-data.json` instead of remote API URLs. Visitors then load images directly from your
> server/CDN at no API cost. See [One-Time Image Download](#one-time-image-download) below.

---

## Getting Google Places API Key

### Step 1: Create a Google Cloud Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account (or create one)
3. Accept the Terms of Service

### Step 2: Create a New Project

1. Click the project dropdown at the top of the page
2. Click "New Project"
3. Enter a project name: `rasnov-tourist-website`
4. Click "Create"
5. Wait for the project to be created (30 seconds)

### Step 3: Enable Places API (new)

1. In the search bar at the top, type "Places API (new)"
2. Click on "Places API (new)" in the results
3. Click the blue "Enable" button
4. Wait for the API to be enabled

### Step 4: Create API Credentials

1. Go to "Credentials" in the left sidebar (or search for it)
2. Click "Create Credentials" at the top
3. Select "API key"
4. Your API key will be generated - **copy it immediately**
5. Click "Close" (we'll restrict it next)

### Step 5: Restrict Your API Key (Important!)

1. Click on your newly created API key to edit it
2. Under "API restrictions":
   - Select "Restrict key"
   - Check only "Places API (new)"
3. Under "Application restrictions":
   - Select "None" (since we're using it server-side in GitHub Actions)
4. Click "Save"

### Step 6: Enable Billing (Don't Worry - It's Free!)

Google requires a billing account even for free tier usage, but you won't be charged:

1. Go to "Billing" in the left sidebar
2. Click "Link a Billing Account"
3. Create a new billing account
4. Enter your credit card information (for verification only)
5. **Note**: You get $200/month free credit, and our usage is ~$3-5/month worth

---

## Getting Unsplash API Key (Optional)

Unsplash provides high-quality fallback images if Google Places doesn't have photos.

### Step 1: Create an Unsplash Account

1. Go to [Unsplash Developers](https://unsplash.com/developers)
2. Click "Register as a developer"
3. Sign up with your email

### Step 2: Create a New Application

1. Go to [Your Apps](https://unsplash.com/oauth/applications)
2. Click "New Application"
3. Accept the API Terms
4. Fill in the form:
   - **Application name**: "Rasnov Tourist Website"
   - **Description**: "Tourist website for Rasnov, Romania"
5. Click "Create application"

### Step 3: Get Your Access Key

1. On your application page, find "Access Key"
2. Copy this key - you'll need it later

**Note**: Unsplash free tier allows 50 requests/hour, which is more than enough for our weekly updates.

---

## Local Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/testsite.git
cd testsite
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Create Environment File

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API keys:
```env
GOOGLE_PLACES_API_KEY=your_actual_google_api_key_here
UNSPLASH_ACCESS_KEY=your_actual_unsplash_key_here
```

**Important**: Never commit `.env` to git! It's already in `.gitignore`.

### Step 4: Test the Data Fetch

```bash
npm run fetch-data
```

You should see output like:
```
🚀 Starting Google Places data fetch...
📍 Center: 45.5889, 25.4631
📏 Radius: 10000m

📍 Fetching locations...
  ✅ Found 20 locations
  Processing [1/20] Rasnov Fortress...
  ...

✅ Data fetch complete!
📊 Summary:
   - Locations: 20
   - Restaurants: 18
   - Accommodations: 15
   - Total: 53
```

### Step 5: View Your Website

```bash
npm start
```

Open http://localhost:3000 in your browser.

---

## One-Time Image Download

To avoid runtime billing from Google Places Photo API URLs, run the data fetch with the
`--download-images` flag **once** after obtaining your API key. This downloads all place photos
to `assets/place-photos/` and writes local paths into `places-data.json` instead of remote URLs.

### Step 1: Run the download

```bash
npm run fetch-data-with-images
```

Or equivalently:

```bash
node build-scripts/fetch-places-data.js --download-images
```

You will see lines like:
```
📸 Image download mode: ON (photos will be saved to assets/place-photos/)
    📸 Saved photo: ChIJxxxxxxxx_0.jpg
```

### Step 2: Commit the downloaded images

The generated images live in `assets/place-photos/`. These files are not auto-generated at
deploy time, so you must commit them to git so they are included in the repository and served
correctly by the site:

```bash
git add assets/place-photos/
git commit -m "chore: add cached place photos"
git push
```

### Step 3: Future data fetches (without `--download-images`)

Subsequent runs of `npm run fetch-data` (without `--download-images`) will automatically detect
and re-use any images already present in `assets/place-photos/`, so no extra API calls are made.
Only run with `--download-images` again when you want to refresh photos (e.g. after a new data
fetch adds new places).

> **Note**: Do **not** add `assets/place-photos/` to `.gitignore`. These files must be committed
> so they survive server rebuilds and deployments.

---

## GitHub Actions Setup

To automatically update data weekly:

### Step 1: Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click "Settings" → "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Add two secrets:

**Secret 1:**
- Name: `GOOGLE_PLACES_API_KEY`
- Value: Your Google Places API key

**Secret 2:**
- Name: `UNSPLASH_ACCESS_KEY`
- Value: Your Unsplash access key

### Step 2: Enable GitHub Actions

1. Go to the "Actions" tab in your repository
2. If prompted, enable GitHub Actions
3. The workflow is already configured in `.github/workflows/update-places-data.yml`

### Step 3: Test the Workflow

1. Go to "Actions" tab
2. Click "Update Places Data" workflow
3. Click "Run workflow" → "Run workflow"
4. Watch it run! It should complete in ~2-3 minutes

### Step 4: Verify the Update

1. After the workflow completes, go to your repository
2. You should see a new commit: "chore: Update places data [automated]"
3. Check `data/places-data.json` to see the fresh data

---

## Running the Data Fetch

### Manual Local Fetch

```bash
npm run fetch-data
```

### Scheduled Automatic Fetch

The GitHub Actions workflow runs automatically every Sunday at 2 AM UTC. No action needed!

### Manual GitHub Actions Trigger

1. Go to "Actions" tab
2. Click "Update Places Data"
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

---

## Troubleshooting

### Error: "GOOGLE_PLACES_API_KEY not set"

**Solution**: Make sure you've created a `.env` file with your API key.

### Error: "API returned status: REQUEST_DENIED"

**Solutions**:
1. Check that Places API (new) is enabled in Google Cloud Console
2. Verify your API key is correct
3. Make sure you've enabled billing (even for free tier)

### Error: "API returned status: OVER_QUERY_LIMIT"

**Solution**: You've hit the rate limit. Wait an hour or check your API quotas in Google Cloud Console.

### No Data Fetched / Empty Results

**Solutions**:
1. Check your internet connection
2. Verify the API key has correct restrictions
3. Try increasing the search radius in `fetch-places-data.js`

### GitHub Actions Workflow Fails

**Solutions**:
1. Check that secrets are set correctly in repository settings
2. Verify the secret names match exactly: `GOOGLE_PLACES_API_KEY`
3. Check the workflow logs for specific error messages

### Photos Not Loading

**Solutions**:
1. Check browser console for errors
2. If photos were never downloaded locally, run `npm run fetch-data-with-images` to download
   them to `assets/place-photos/` and commit the folder to git
3. If `assets/place-photos/` exists locally but images are missing on the deployed site,
   make sure you committed and pushed the `assets/place-photos/` folder
4. Google Places photo API URLs (used only as a fallback) may be blocked by CORS or expire –
   the local image approach avoids this entirely

---

## API Usage and Costs

### Expected Monthly Usage

**Google Places API**:
- Nearby Search: ~3 calls/week = 12/month
- Place Details: ~60 calls/week = 240/month
- Place Photos: ~180 references/week = 720/month
- **Total Cost**: ~$3-5/month worth (but FREE with $200 credit!)

**Unsplash API** (Optional):
- Photos: ~10 calls/week = 40/month
- **Limit**: 50/hour, 100/day (free)
- **Cost**: $0

### Free Tier Limits

**Google Cloud Free Tier**:
- $200/month credit (every month!)
- Our usage: ~$5/month
- **Remaining**: $195/month for other projects

**Unsplash Free Tier**:
- 50 requests/hour
- Our usage: ~1 request/week
- **Cost**: $0 forever

### Staying Within Free Limits

✅ **Do**:
- Keep weekly schedule (don't run hourly)
- Use photo references efficiently
- Run `npm run fetch-data-with-images` once and commit `assets/place-photos/` to git
- Use local cached images (avoids runtime billing entirely)

❌ **Don't**:
- Run data fetch on every deploy
- Make runtime API calls from the website
- Embed raw Google Places Photo API URLs in JSON (bills per visitor browser request)
- Fetch data more than once per day

---

## Deployment

### GitHub Pages

The site works great with GitHub Pages:

1. Go to repository "Settings" → "Pages"
2. Set source to your main branch
3. Wait 2-3 minutes for deployment
4. Visit your site at: `https://YOUR_USERNAME.github.io/testsite/`

The workflow will automatically update `data/places-data.json`, and GitHub Pages will redeploy.

### Other Hosts (Netlify, Vercel, etc.)

1. Connect your repository to the hosting service
2. Set build command: `npm run fetch-data` (optional)
3. Deploy!

The static site works everywhere - no server required!

---

## Next Steps

1. ✅ Get your API keys
2. ✅ Test locally with `npm run fetch-data`
3. ✅ Add secrets to GitHub
4. ✅ Run the workflow manually once
5. ✅ Deploy your site
6. 🎉 Enjoy automatic weekly updates!

---

## Need Help?

- Check [Google Cloud Documentation](https://cloud.google.com/docs)
- Read [Places API (new) Guide](https://developers.google.com/maps/documentation/places/web-service/overview)
- Check [Unsplash API Docs](https://unsplash.com/documentation)
- Open an issue in this repository

---

## Summary

This setup gives you:
- ✅ Real location data from Google Places
- ✅ High-quality photos
- ✅ Automatic weekly updates
- ✅ 100% free (within generous limits)
- ✅ No runtime API costs
- ✅ Fast, static site deployment

**Total cost: $0/month** 🎉
