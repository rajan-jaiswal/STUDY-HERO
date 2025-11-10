# Deployment Guide for Study Hero

This guide provides step-by-step instructions for deploying the Study Hero application to various platforms.

## 🚀 Deployment Options

### Option 1: Render (Recommended - Easiest)
Render provides free hosting for both backend and frontend with automatic SSL certificates.

### Option 2: Vercel (Frontend) + Railway (Backend)
- Vercel: Excellent for React apps (free tier)
- Railway: Good for Node.js backends (paid, but has free trial)

### Option 3: Heroku
Traditional PaaS platform (paid, but reliable)

---

## 📋 Prerequisites

1. **GitHub Account** - Your code is already on GitHub
2. **Cloud Database** - You'll need a MySQL database
   - Options: PlanetScale (free), AWS RDS, Railway Database, or Render PostgreSQL (convert schema)
3. **API Keys**:
   - YouTube Data API v3 key
   - Mistral API key (for quiz generation)
   - Judge0/RapidAPI key (for code execution)

---

## 🎯 Option 1: Deploy to Render (Recommended)

### Step 1: Set Up Cloud Database

#### Option A: PlanetScale (Free MySQL)
1. Go to [PlanetScale](https://planetscale.com/)
2. Sign up for free account
3. Create a new database
4. Copy the connection string (you'll need: host, user, password, database name)

#### Option B: Railway Database
1. Go to [Railway](https://railway.app/)
2. Create new project
3. Add MySQL database
4. Copy connection details

### Step 2: Deploy Backend to Render

1. **Sign up/Login to Render**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `rajan-jaiswal/STUDY-HERO`
   - Configure:
     - **Name**: `study-hero-backend`
     - **Root Directory**: `backend`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Instance Type**: Free

3. **Set Environment Variables**
   Add these in Render dashboard:
   ```
   DB_HOST=your-database-host
   DB_PORT=3306
   DB_USER=your-database-user
   DB_PASSWORD=your-database-password
   DB_NAME=your-database-name
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   PORT=10000
   NODE_ENV=production
   YOUTUBE_API_KEY=your-youtube-api-key
   MISTRAL_API_KEY=your-mistral-api-key
   CODE_EXEC_PROVIDER=judge0
   JUDGE0_BASE_URL=https://judge0-ce.p.rapidapi.com
   JUDGE0_USE_RAPIDAPI=true
   JUDGE0_RAPIDAPI_KEY=your-rapidapi-key
   PYTHON_PATH=python3
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically deploy
   - Note the URL: `https://study-hero-backend.onrender.com`

### Step 3: Initialize Database

1. **Run Database Migration**
   - Option A: Use Render's Shell
     - Go to your service → Shell
     - Run: `mysql -h your-host -u your-user -p your-database < database.sql`
   
   - Option B: Use a local MySQL client
     - Connect to your cloud database
     - Run the SQL from `backend/database.sql`

### Step 4: Deploy Frontend to Render

1. **Create Static Site**
   - Click "New +" → "Static Site"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `study-hero-frontend`
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install && npm run build`
     - **Publish Directory**: `build`
     - **Environment**: `Node`

2. **Set Environment Variables**
   ```
   REACT_APP_API_URL=https://study-hero-backend.onrender.com
   ```

3. **Deploy**
   - Click "Create Static Site"
   - Frontend will be deployed to: `https://study-hero-frontend.onrender.com`

### Step 5: Update CORS in Backend

The backend CORS is already configured to allow all origins in development. For production, update `backend/server.js` to allow your frontend URL.

---

## 🎯 Option 2: Vercel (Frontend) + Railway (Backend)

### Deploy Backend to Railway

1. **Sign up for Railway**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Select your repository

3. **Configure Backend Service**
   - Railway auto-detects Node.js
   - Set Root Directory: `backend`
   - Add environment variables (same as Render)
   - Railway will auto-deploy

4. **Add MySQL Database**
   - Click "New" → "Database" → "MySQL"
   - Railway provides connection details automatically
   - Update environment variables with database credentials

### Deploy Frontend to Vercel

1. **Sign up for Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub

2. **Import Project**
   - Click "New Project"
   - Import `rajan-jaiswal/STUDY-HERO`
   - Configure:
     - **Framework Preset**: Create React App
     - **Root Directory**: `frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `build`

3. **Set Environment Variables**
   ```
   REACT_APP_API_URL=https://your-railway-backend-url.railway.app
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will deploy and provide a URL

---

## 🔧 Configuration Updates

### Update Backend CORS

Update `backend/server.js` to allow your frontend domain:

```javascript
const cors = require('cors');

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://your-frontend-url.vercel.app',
  credentials: true
};

app.use(cors(corsOptions));
```

### Update Frontend API URL

The frontend already uses `REACT_APP_API_URL` environment variable. Make sure to set it in your deployment platform.

---

## 📊 Database Setup

### Using PlanetScale (Recommended for MySQL)

1. **Create Database**
   ```bash
   # Install PlanetScale CLI
   npm install -g @planetscale/cli
   
   # Login
   pscale auth login
   
   # Create database
   pscale database create study_hero
   
   # Connect and run schema
   pscale connect study_hero --execute "source backend/database.sql"
   ```

### Using Railway MySQL

Railway automatically creates the database. You just need to:
1. Run the SQL schema from `backend/database.sql`
2. Update environment variables with connection details

---

## 🔐 Environment Variables Checklist

### Backend (.env)
```env
# Database
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name

# Server
PORT=10000
NODE_ENV=production

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-characters

# APIs
YOUTUBE_API_KEY=your-youtube-api-key
MISTRAL_API_KEY=your-mistral-api-key
JUDGE0_RAPIDAPI_KEY=your-rapidapi-key

# Code Execution
CODE_EXEC_PROVIDER=judge0
JUDGE0_BASE_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_USE_RAPIDAPI=true

# Python (for quiz generation)
PYTHON_PATH=python3
```

### Frontend (.env)
```env
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Database Connection Failed
**Solution**: 
- Check database credentials
- Ensure database is accessible from your hosting provider
- Check firewall settings

### Issue 2: CORS Errors
**Solution**: 
- Update CORS configuration in backend
- Add frontend URL to allowed origins

### Issue 3: Python Script Not Found
**Solution**: 
- Ensure Python is installed on the server
- Set `PYTHON_PATH` environment variable
- For Render, Python is pre-installed

### Issue 4: File Uploads Not Working
**Solution**: 
- Local file storage won't work in serverless environments
- Consider using cloud storage (AWS S3, Cloudinary) for production

### Issue 5: Build Failures
**Solution**: 
- Check Node.js version (use Node 18+)
- Ensure all dependencies are in package.json
- Check build logs for specific errors

---

## 📝 Post-Deployment Checklist

- [ ] Database schema is created
- [ ] Environment variables are set
- [ ] Backend is accessible (test with `/` endpoint)
- [ ] Frontend can connect to backend
- [ ] CORS is configured correctly
- [ ] SSL certificates are active (HTTPS)
- [ ] API keys are working
- [ ] File uploads work (if using cloud storage)
- [ ] Database backups are configured

---

## 🎉 Testing Your Deployment

1. **Test Backend**
   ```bash
   curl https://your-backend-url.onrender.com/
   # Should return: "Study Hero API is running! 🚀"
   ```

2. **Test Frontend**
   - Visit your frontend URL
   - Try registering a new user
   - Test login functionality

3. **Test API Connection**
   - Open browser console on frontend
   - Check for CORS errors
   - Test API calls

---

## 🔄 Continuous Deployment

Both Render and Vercel automatically deploy when you push to GitHub:

1. Make changes to your code
2. Commit and push to GitHub
3. Deployment happens automatically
4. Check deployment logs for errors

---

## 💰 Cost Estimation

### Free Tier (Suitable for testing)
- **Render**: Free tier available (with limitations)
- **Vercel**: Free tier available
- **PlanetScale**: Free tier available
- **Total**: $0/month

### Paid Tier (For production)
- **Render**: $7-25/month per service
- **Vercel**: Free for personal projects
- **PlanetScale**: Free tier or $29/month
- **Total**: ~$10-50/month

---

## 🆘 Need Help?

- Check deployment logs in your hosting platform
- Review error messages carefully
- Test locally first
- Check environment variables
- Verify database connection

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [PlanetScale Documentation](https://planetscale.com/docs)

---

**Happy Deploying! 🚀**

