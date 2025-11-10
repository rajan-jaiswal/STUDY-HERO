<<<<<<< HEAD
# STUDY HERO

An educational platform that connects teachers and students, providing a comprehensive learning management system with quiz generation, assignments, course management, and AI-powered features.

## 🚀 Features

### For Teachers
- Create and manage courses
- Generate quizzes from PDF documents using AI
- Assign quizzes to students
- Grade submissions
- Track student progress and analytics
- Manual quiz builder
- YouTube video suggestions for quiz topics

### For Students
- Enroll in courses
- Take quizzes with timer functionality
- Submit assignments
- View quiz results and recommendations
- Access learning resources
- Code execution environment (IDE)
- Student analytics dashboard

### Technical Features
- **AI-Powered Quiz Generation**: Automatically generate quizzes from PDF documents
- **YouTube Integration**: Get relevant educational video suggestions based on quiz topics
- **Code Execution**: Run code in multiple languages (Python, JavaScript, C++, Java) using Judge0
- **Handwriting Recognition**: ML model for handwriting analysis
- **JWT Authentication**: Secure authentication system
- **Role-Based Access Control**: Separate dashboards for teachers and students
- **Webcam Proctoring**: Monitor students during quizzes
- **File Upload System**: Support for PDF and other document formats

## 📁 Project Structure

```
STUDY-HERO/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── middleware/     # Authentication middleware
│   │   ├── models/         # Data models
│   │   └── routes/         # API routes
│   ├── m1/                 # ML models (handwriting recognition)
│   ├── uploads/            # Uploaded files
│   ├── database.sql        # Database schema
│   ├── server.js           # Main server file
│   └── package.json        # Backend dependencies
│
├── frontend/               # React/TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── styles/         # CSS and Tailwind config
│   ├── public/             # Static files
│   └── package.json        # Frontend dependencies
│
├── scripts/                # Python scripts
│   ├── quiz_generator.py   # AI quiz generation
│   └── requirements.txt    # Python dependencies
│
└── README.md              # This file
```

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **MySQL** database
- **JWT** for authentication
- **Multer** for file uploads
- **PDF-Parse** for PDF processing
- **bcryptjs** for password hashing

### Frontend
- **React** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API calls

### AI/ML
- **Python** for AI models
- **Judge0** for code execution
- **YouTube Data API v3** for video suggestions

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v14.0.0 or higher)
- **npm** (v6.0.0 or higher)
- **MySQL** (v5.7 or higher)
- **Python** (v3.8 or higher) - for AI features
- **Git** - for version control

## 🔧 Installation

### 1. Clone the repository

```bash
git clone https://github.com/rajan-jaiswal/STUDY-HERO.git
cd STUDY-HERO
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file from example
cp env.example .env

# Edit .env file with your database credentials and API keys
# DB_HOST=localhost
# DB_USER=your_username
# DB_PASSWORD=your_password
# DB_NAME=study_hero_db
# JWT_SECRET=your_jwt_secret
# PORT=4000
# YOUTUBE_API_KEY=your_youtube_api_key

# Create database
mysql -u root -p < database.sql

# Start the server
npm start
# or for development with auto-reload
npm run dev
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install dependencies
npm install

# Create .env file (optional, for API URL configuration)
# REACT_APP_API_URL=http://localhost:4000

# Start the development server
npm start
```

The frontend will run on `http://localhost:3000` and the backend on `http://localhost:4000`.

### 4. Python Scripts Setup (Optional - for AI features)

```bash
# Navigate to scripts directory
cd scripts

# Install Python dependencies
pip install -r requirements.txt
```

## 🔑 Environment Variables

### Backend (.env)

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=study_hero_db

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# Server Port
PORT=4000

# YouTube API Key (Get from Google Cloud Console)
YOUTUBE_API_KEY=your_youtube_api_key_here

# Code Execution (Judge0) Configuration
CODE_EXEC_PROVIDER=judge0
JUDGE0_BASE_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_USE_RAPIDAPI=true
JUDGE0_RAPIDAPI_KEY=your_rapidapi_key_here

# Environment
NODE_ENV=development
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:4000
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login
- `GET /api/users/profile` - Get user profile (protected)
- `PUT /api/users/profile` - Update user profile (protected)

### Course Endpoints
- `GET /api/courses` - Get all courses
- `POST /api/courses` - Create new course (teacher only)
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course (teacher only)
- `DELETE /api/courses/:id` - Delete course (teacher only)
- `POST /api/courses/:id/enroll` - Enroll in course (student only)

### Quiz Endpoints
- `GET /api/courses/:id/quizzes` - Get course quizzes
- `POST /api/courses/:id/quizzes` - Create quiz (teacher only)
- `GET /api/quizzes/:id` - Get quiz details
- `PUT /api/quizzes/:id` - Update quiz (teacher only)
- `DELETE /api/quizzes/:id` - Delete quiz (teacher only)
- `POST /api/quizzes/:id/submit` - Submit quiz (student only)
- `GET /api/quiz/:quiz_id/video-suggestions` - Get YouTube video suggestions

### Assignment Endpoints
- `GET /api/assignments/course/:courseId` - Get course assignments
- `POST /api/assignments` - Create assignment (teacher only)

For detailed API documentation, see [backend/README.md](backend/README.md)

## 🎯 Usage

### For Teachers

1. **Register/Login**: Create an account with teacher role
2. **Create Courses**: Add new courses for your students
3. **Generate Quizzes**: Upload PDF documents to auto-generate quizzes
4. **Assign Quizzes**: Assign quizzes to students with due dates
5. **Grade Submissions**: Review and grade student submissions
6. **View Analytics**: Track student performance and progress

### For Students

1. **Register/Login**: Create an account with student role
2. **Browse Courses**: Explore available courses
3. **Enroll in Courses**: Join courses you're interested in
4. **Take Quizzes**: Complete assigned quizzes within time limits
5. **View Results**: See your quiz results and recommendations
6. **Access Resources**: Get YouTube video suggestions for topics you struggled with

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**Rajan Jaiswal**
- GitHub: [@rajan-jaiswal](https://github.com/rajan-jaiswal)

## 🙏 Acknowledgments

- YouTube Data API v3 for video suggestions
- Judge0 for code execution capabilities
- All open-source libraries and frameworks used in this project

## 📞 Support

For support, email your-email@example.com or open an issue in the GitHub repository.

## 🗺️ Roadmap

- [ ] Email notifications for quiz deadlines
- [ ] Chat/messaging system
- [ ] Advanced analytics and reporting
- [ ] Mobile app (React Native)
- [ ] Video conferencing integration
- [ ] Certificate generation
- [ ] Multi-language support

---

⭐ If you like this project, please give it a star on GitHub!

=======
# STUDY-HERO
>>>>>>> c672707525ce4a65221e13094f766f794f9add4f
