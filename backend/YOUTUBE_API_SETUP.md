# YouTube API Setup Guide for Study Hero

## Step 1: Google Cloud Console Setup

### 1.1 Create/Select Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Make sure billing is enabled (required for API usage)

### 1.2 Enable YouTube Data API v3
1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "YouTube Data API v3"
3. Click on it and press "Enable"

### 1.3 Create API Key
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the generated API key
4. (Optional) Click "Restrict Key" to limit usage to YouTube Data API v3

## Step 2: Environment Configuration

### 2.1 Create .env File
Create a `.env` file in the `study_hero_backend` directory:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=study_hero_db

# JWT Secret
JWT_SECRET=studyherosecret

# Server Port
PORT=4000

# YouTube API Key
YOUTUBE_API_KEY=your_youtube_api_key_here

# Other API Keys
NODE_ENV=development
```

### 2.2 Replace API Key
Replace `your_youtube_api_key_here` with the actual API key from Step 1.3

## Step 3: Test the Integration

### 3.1 Run Test Script
```bash
cd study_hero_backend
npm run test:youtube
```

### 3.2 Expected Output
If successful, you should see:
```
🔍 Testing YouTube API...
✅ YouTube API test successful!
📊 Found 3 videos

1. [Video Title]
   Channel: [Channel Name]
   URL: https://www.youtube.com/watch?v=[video_id]
```

## Step 4: Supported Engineering Topics

The system automatically detects and suggests videos for these engineering subjects:

### Computer Science & Programming
- Programming languages (Python, Java, JavaScript, C++)
- Web development (HTML, CSS, React, Angular, Node.js)
- Database systems (SQL, MongoDB)
- Software engineering concepts

### Electrical Engineering
- Circuit analysis and design
- Electronics components (transistors, capacitors, inductors)
- Microcontrollers (Arduino, Raspberry Pi)
- Sensors and actuators

### Mechanical Engineering
- Mechanics and dynamics
- Thermodynamics
- Machine design
- Fluid mechanics
- Control systems

### Civil Engineering
- Structural analysis
- Construction materials
- Surveying and design
- Transportation engineering

### Chemical Engineering
- Chemical reactions and processes
- Unit operations
- Process design
- Biotechnology

### Other Engineering Fields
- Robotics & Automation
- Artificial Intelligence & Machine Learning
- Cybersecurity
- Data Science & Analytics
- Cloud Computing

## Step 5: API Usage and Quotas

### 5.1 Daily Quotas
- YouTube Data API v3 has daily quotas
- Default: 10,000 units per day
- Search operation: 100 units per request
- Plan accordingly for production use

### 5.2 Monitoring Usage
1. Go to Google Cloud Console > APIs & Services > Dashboard
2. Select YouTube Data API v3
3. Monitor quota usage in the "Quotas" tab

### 5.3 Cost Optimization
- Implement caching to reduce API calls
- Consider using YouTube's search filters
- Monitor and optimize search queries

## Step 6: Troubleshooting

### 6.1 Common Issues

#### API Key Not Found
```
❌ YouTube API key not found in environment variables
```
**Solution:** Check your `.env` file and ensure `YOUTUBE_API_KEY` is set correctly.

#### API Not Enabled
```
❌ YouTube API test failed: 403 Forbidden
```
**Solution:** Enable YouTube Data API v3 in Google Cloud Console.

#### Quota Exceeded
```
❌ YouTube API test failed: 403 Quota Exceeded
```
**Solution:** Wait for quota reset or request quota increase.

### 6.2 Error Codes
- `400`: Bad Request - Check API parameters
- `401`: Unauthorized - Invalid API key
- `403`: Forbidden - API not enabled or quota exceeded
- `500`: Server Error - YouTube service issue

## Step 7: Production Considerations

### 7.1 Security
- Restrict API key to specific domains/IPs
- Use environment variables (never commit API keys to version control)
- Implement rate limiting

### 7.2 Performance
- Implement caching for video suggestions
- Use appropriate video duration filters
- Consider implementing fallback content

### 7.3 Monitoring
- Set up alerts for quota usage
- Monitor API response times
- Track user engagement with video suggestions

## Support

For additional help:
1. Check [YouTube Data API v3 Documentation](https://developers.google.com/youtube/v3)
2. Review Google Cloud Console error logs
3. Contact the development team

---

**Note:** This integration is specifically designed for engineering and technology education. The system will automatically filter and suggest relevant technical content based on quiz topics.



