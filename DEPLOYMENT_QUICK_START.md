# 🚀 Quick Deployment Guide - Study Hero

## Easiest Way: Deploy to Render (Free Tier)

### Step 1: Set Up Database (5 minutes)

1. **Create PlanetScale Account** (Free MySQL)
   - Go to https://planetscale.com
   - Sign up with GitHub
   - Create a new database: `study-hero`
   - Copy connection credentials

2. **Initialize Database**
   - Click on your database → "Console"
   - Run the SQL from `backend/database.sql`
   - Or use PlanetScale CLI:
     ```bash
     pscale connect study-hero --execute "source backend/database.sql"
     ```

### Step 2: Deploy Backend (10 minutes)

1. **Go to Render**
   - Visit https://render.com
   - Sign up with GitHub
   - Click "New +" → "Web Service"

2. **Connect Repository**
   - Select: `rajan-jaiswal/STUDY-HERO`
   - Settings:
     - **Name**: `study-hero-backend`
     - **Root Directory**: `backend`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free

3. **Add Environment Variables**
   Click "Advanced" → "Add Environment Variable":
   ```
   DB_HOST=your-planetscale-host
   DB_USER=your-planetscale-user
   DB_PASSWORD=your-planetscale-password
   DB_NAME=study-hero
   DB_PORT=3306
   JWT_SECRET=generate-a-random-secret-key-here-min-32-characters
   PORT=10000
   NODE_ENV=production
   YOUTUBE_API_KEY=your-youtube-api-key
   MISTRAL_API_KEY=your-mistral-api-key
   JUDGE0_RAPIDAPI_KEY=your-rapidapi-key
   CODE_EXEC_PROVIDER=judge0
   JUDGE0_BASE_URL=https://judge0-ce.p.rapidapi.com
   JUDGE0_USE_RAPIDAPI=true
   PYTHON_PATH=python3
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (2-3 minutes)
   - Copy your backend URL: `https://study-hero-backend.onrender.com`

### Step 3: Deploy Frontend (5 minutes)

1. **Create Static Site on Render**
   - Click "New +" → "Static Site"
   - Select: `rajan-jaiswal/STUDY-HERO`
   - Settings:
     - **Name**: `study-hero-frontend`
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install && npm run build`
     - **Publish Directory**: `build`

2. **Add Environment Variable**
   ```
   REACT_APP_API_URL=https://study-hero-backend.onrender.com
   ```
   (Replace with your actual backend URL)

3. **Deploy**
   - Click "Create Static Site"
   - Wait for deployment
   - Your app is live! 🎉

### Step 4: Update CORS (2 minutes)

1. **Update Backend CORS**
   - In Render, go to your backend service
   - Add environment variable:
     ```
     FRONTEND_URL=https://study-hero-frontend.onrender.com
     ```
   - Redeploy backend (automatic on env var change)

### Step 5: Test Your Deployment

1. **Test Backend**
   ```bash
   curl https://study-hero-backend.onrender.com/
   # Should return: "Study Hero API is running! 🚀"
   ```

2. **Test Frontend**
   - Visit your frontend URL
   - Try registering a user
   - Test login

## 🎯 Alternative: Vercel + Railway

### Backend on Railway
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select repository
4. Set Root Directory: `backend`
5. Add environment variables (same as Render)
6. Add MySQL database (Railway provides automatically)
7. Deploy!

### Frontend on Vercel
1. Go to https://vercel.com
2. New Project → Import GitHub repo
3. Settings:
   - Framework: Create React App
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `build`
4. Add Environment Variable:
   ```
   REACT_APP_API_URL=https://your-railway-url.railway.app
   ```
5. Deploy!

## 🔑 Getting API Keys

### YouTube API Key
1. Go to https://console.cloud.google.com
2. Create project
3. Enable YouTube Data API v3
4. Create API Key
5. Copy key

### Mistral API Key
1. Go to https://console.mistral.ai
2. Sign up
3. Get API key from dashboard
4. Copy key

### RapidAPI Key (Judge0)
1. Go to https://rapidapi.com
2. Sign up
3. Subscribe to Judge0 API
4. Copy API key from dashboard

## ✅ Deployment Checklist

- [ ] Database created and schema initialized
- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Environment variables set
- [ ] CORS configured
- [ ] API keys added
- [ ] Test user registration
- [ ] Test user login
- [ ] Test API endpoints

## 🆘 Troubleshooting

### Backend won't start
- Check environment variables
- Check database connection
- Review deployment logs

### Frontend can't connect to backend
- Check `REACT_APP_API_URL` is correct
- Check CORS configuration
- Check backend is running

### Database connection fails
- Verify credentials
- Check database is accessible
- Check firewall settings

## 🎉 You're Done!

Your Study Hero app is now live on the internet! Share your frontend URL with users.

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)

