const express = require('express');
const router = express.Router();
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const db = require('../config/db');
const { authMiddleware, teacherMiddleware } = require('../middleware/authMiddleware');
const pdfParse = require('pdf-parse');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Generate random access code
function generateAccessCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// GET: Get teacher's courses for quiz creation
router.get('/teacher-courses', authMiddleware, teacherMiddleware, async (req, res) => {
    const teacher_id = req.user.id;

    try {
        const [courses] = await db.execute(
            'SELECT id, title, description FROM courses WHERE teacher_id = ? ORDER BY title',
            [teacher_id]
        );

        console.log(`📚 Found ${courses.length} courses for teacher ${teacher_id}:`, courses);
        res.json(courses);
    } catch (err) {
        console.error('❌ Fetch teacher courses error:', err);
        res.status(500).json({ error: 'Failed to fetch teacher courses' });
    }
});

// GET: Debug endpoint to check all courses and users
router.get('/debug', authMiddleware, async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, username, email, role FROM users');
        const [courses] = await db.execute('SELECT id, title, teacher_id FROM courses');
        
        res.json({
            currentUser: req.user,
            users: users,
            courses: courses
        });
    } catch (err) {
        console.error('❌ Debug error:', err);
        res.status(500).json({ error: 'Debug failed' });
    }
});

// Helper to ensure publish columns exist on quizzes table
async function ensurePublishColumns() {
    try {
        // Check for columns in information_schema
        const [columns] = await db.execute(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_NAME = 'quizzes' AND COLUMN_NAME IN ('is_published','publish_at')`
        );
        const existing = new Set(columns.map(c => c.COLUMN_NAME));

        if (!existing.has('is_published')) {
            await db.execute(`ALTER TABLE quizzes ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 0`);
        }
        if (!existing.has('publish_at')) {
            await db.execute(`ALTER TABLE quizzes ADD COLUMN publish_at DATETIME NULL`);
        }
    } catch (e) {
        console.error('⚠️ ensurePublishColumns error:', e.message);
        // Do not throw; allow routes to continue even if migration failed
    }
}

// GET: Get all available quizzes for students (only published and active by time)
router.get('/available', authMiddleware, async (req, res) => {
    try {
        await ensurePublishColumns();
        const [quizzes] = await db.execute(
            `SELECT q.id, q.title, q.access_code, q.duration_minutes, q.created_at,
                    c.title as course_name, u.username as teacher_name
             FROM quizzes q
             JOIN courses c ON q.course_id = c.id
             JOIN users u ON q.teacher_id = u.id
             WHERE (q.is_published = 1)
               AND (q.publish_at IS NULL OR q.publish_at <= NOW())
             ORDER BY COALESCE(q.publish_at, q.created_at) DESC`
        );

        res.json(quizzes);
    } catch (err) {
        console.error('❌ Fetch available quizzes error:', err);
        res.status(500).json({ error: 'Failed to fetch available quizzes' });
    }
});

// GET: Get quizzes created by teacher
router.get('/teacher-quizzes', authMiddleware, teacherMiddleware, async (req, res) => {
    const teacher_id = req.user.id;

    try {
        await ensurePublishColumns();
        const [quizzes] = await db.execute(
            `SELECT q.id, q.title, q.access_code, q.duration_minutes, q.created_at,
                    c.title as course_name, q.is_auto_generated, q.questions,
                    q.is_published, q.publish_at
             FROM quizzes q
             JOIN courses c ON q.course_id = c.id
             WHERE q.teacher_id = ?
             ORDER BY q.created_at DESC`,
            [teacher_id]
        );

        res.json(quizzes);
    } catch (err) {
        console.error('❌ Fetch teacher quizzes error:', err);
        res.status(500).json({ error: 'Failed to fetch teacher quizzes' });
    }
});

// POST: Publish a quiz with optional schedule time
router.post('/:quiz_id/publish', authMiddleware, teacherMiddleware, async (req, res) => {
    const { quiz_id } = req.params;
    const { publish_at } = req.body; // ISO string or null for immediate
    const teacher_id = req.user.id;
    try {
        await ensurePublishColumns();
        // Ensure quiz belongs to teacher
        const [rows] = await db.execute(`SELECT id FROM quizzes WHERE id = ? AND teacher_id = ?`, [quiz_id, teacher_id]);
        if (rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to publish this quiz' });
        }
        await db.execute(`UPDATE quizzes SET is_published = 1, publish_at = ${publish_at ? '?' : 'NULL'} WHERE id = ?`, publish_at ? [new Date(publish_at), quiz_id] : [quiz_id]);
        res.json({ message: 'Quiz published', quiz_id, publish_at: publish_at || null });
    } catch (err) {
        console.error('❌ Publish quiz error:', err);
        res.status(500).json({ error: 'Failed to publish quiz' });
    }
});

// POST: Unpublish a quiz
router.post('/:quiz_id/unpublish', authMiddleware, teacherMiddleware, async (req, res) => {
    const { quiz_id } = req.params;
    const teacher_id = req.user.id;
    try {
        await ensurePublishColumns();
        const [rows] = await db.execute(`SELECT id FROM quizzes WHERE id = ? AND teacher_id = ?`, [quiz_id, teacher_id]);
        if (rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to unpublish this quiz' });
        }
        await db.execute(`UPDATE quizzes SET is_published = 0 WHERE id = ?`, [quiz_id]);
        res.json({ message: 'Quiz unpublished', quiz_id });
    } catch (err) {
        console.error('❌ Unpublish quiz error:', err);
        res.status(500).json({ error: 'Failed to unpublish quiz' });
    }
});

// POST: Create quiz manually
router.post('/create', authMiddleware, teacherMiddleware, async (req, res) => {
    const { course_id, title, questions, duration_minutes } = req.body;
    const teacher_id = req.user.id;
    const access_code = generateAccessCode();

    console.log('🔍 Quiz creation request:', {
        course_id: course_id,
        title: title,
        teacher_id: teacher_id,
        duration_minutes: duration_minutes
    });

    try {
        // First, verify that the course exists and belongs to the teacher
        const [courseCheck] = await db.execute(
            'SELECT id FROM courses WHERE id = ? AND teacher_id = ?',
            [course_id, teacher_id]
        );

        console.log('🔍 Course check result:', courseCheck);

        if (courseCheck.length === 0) {
            console.log('❌ Course not found or permission denied');
            return res.status(400).json({ 
                error: 'Course not found or you do not have permission to create quizzes for this course' 
            });
        }

        const [result] = await db.execute(
            `INSERT INTO quizzes (course_id, teacher_id, title, questions, access_code, duration_minutes, is_auto_generated)
             VALUES (?, ?, ?, ?, ?, ?, false)`,
            [course_id, teacher_id, title, JSON.stringify(questions), access_code, duration_minutes]
        );

        res.json({
            message: 'Quiz created successfully',
            quiz_id: result.insertId,
            access_code
        });
    } catch (err) {
        console.error("❌ Error creating quiz:", err);
        res.status(500).json({ error: 'Failed to create quiz' });
    }
});

// POST: Generate and store quiz from file
router.post('/generate', authMiddleware, teacherMiddleware, upload.single('file'), async (req, res) => {
    const { title, duration_minutes = 30 } = req.body;
    const teacher_id = req.user.id;
    const access_code = generateAccessCode();

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Extract text from PDF first to get content for course creation
        const pdfText = await extractTextFromPdf(req.file.path);

        if (!pdfText) {
            return res.status(400).json({ error: 'Failed to extract text from PDF' });
        }

        // Generate course title from PDF filename or use default
        const courseTitle = title ? `${title} Course` : `Course from ${req.file.originalname}`;
        
        // Create a new course automatically for this teacher
        const [courseResult] = await db.execute(
            'INSERT INTO courses (title, description, teacher_id) VALUES (?, ?, ?)',
            [courseTitle, `Auto-generated course from ${req.file.originalname}`, teacher_id]
        );
        
        const course_id = courseResult.insertId;
        console.log(`✅ Created new course with ID: ${course_id} for teacher ${teacher_id}`);

        if (!pdfText) {
            return res.status(400).json({ error: 'Failed to extract text from PDF' });
        }

        // Resolve a working Python executable (Windows-friendly)
        console.log(`Current working directory: ${process.cwd()}`);
        const { execSync } = require('child_process');
        const candidates = [];
        if (process.env.PYTHON_PATH) {
            candidates.push({ cmd: process.env.PYTHON_PATH, args: [] });
        }
        // On Windows, 'py -3' is common; also try plain 'py'
        if (process.platform === 'win32') {
            candidates.push(
                { cmd: 'py', args: ['-3'] },
                { cmd: 'py', args: [] }
            );
        }
        // Cross-platform fallbacks
        candidates.push(
            { cmd: 'python', args: [] },
            { cmd: 'python3', args: [] }
        );

        let selected = null;
        for (const c of candidates) {
            try {
                const checkArgs = [...c.args, '--version'];
                execSync([c.cmd, ...checkArgs].join(' '), { stdio: 'pipe' });
                selected = c;
                break;
            } catch (_) {
                // try next
            }
        }

        if (!selected) {
            console.error('❌ No working Python interpreter found. Tried:', candidates.map(c => `${c.cmd} ${c.args.join(' ')}`).join(' | '));
            return res.status(500).json({ 
                error: 'Python is not available. Install Python 3 and ensure it is in PATH, or set PYTHON_PATH in backend .env.' 
            });
        }

        console.log(`✅ Using Python executable: ${selected.cmd} ${selected.args.join(' ')}`);

        const pythonProcess = spawn(selected.cmd, [...selected.args, 'quiz_generator.py'], {
            cwd: require('path').resolve(__dirname, '..', '..')
        });
        let generatedQuiz = '';
        let pythonError = '';

        // Add error handling for stdin
        pythonProcess.stdin.on('error', (err) => {
            console.error('Python process stdin error:', err);
        });
        try {
            pythonProcess.stdin.write(pdfText);
            pythonProcess.stdin.end();
        } catch (err) {
            console.error('Error writing to Python process:', err);
        }

        pythonProcess.stdout.on('data', (data) => {
            generatedQuiz += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            pythonError += data.toString();
        });

        await new Promise((resolve, reject) => {
            pythonProcess.on('close', async (code) => {
                // Check if output contains an error message
                if (generatedQuiz.trim().startsWith('Error:')) {
                    console.error('Python script returned error:', generatedQuiz);
                    const errorMessage = generatedQuiz.trim().replace(/^Error:\s*/, '');
                    return reject(new Error(errorMessage || 'Quiz generation failed'));
                }

                if (code !== 0 || !generatedQuiz) {
                    console.error('Python process failed with code:', code);
                    console.error('Python stderr:', pythonError);
                    console.error('Python stdout (generatedQuiz):', generatedQuiz);
                    
                    // Try to extract error message from stderr or stdout
                    const errorMessage = pythonError.trim() || generatedQuiz.trim() || 'Quiz generation failed. Please check Mistral API configuration and ensure PDF contains readable text.';
                    return reject(new Error(errorMessage));
                }

                try {
                    // Validate that generatedQuiz is valid JSON
                    let quizData;
                    try {
                        quizData = JSON.parse(generatedQuiz);
                    } catch (parseError) {
                        console.error('Failed to parse quiz JSON:', parseError);
                        console.error('Generated quiz content:', generatedQuiz);
                        return reject(new Error('Quiz generation returned invalid format. Please try again or check API configuration.'));
                    }

                    // Validate that we have at least one question
                    if (!Array.isArray(quizData) || quizData.length === 0) {
                        return reject(new Error('No questions were generated from the PDF. Please ensure the PDF contains sufficient text content.'));
                    }

                    // Generate quiz title from PDF filename if not provided
                    const quizTitle = title || `Quiz on ${req.file.originalname.replace('.pdf', '')}`;
                    
                    const [result] = await db.execute(
                        `INSERT INTO quizzes (course_id, teacher_id, title, questions, access_code, duration_minutes, is_auto_generated)
                         VALUES (?, ?, ?, ?, ?, ?, true)`,
                        [course_id, teacher_id, quizTitle, generatedQuiz, access_code, duration_minutes]
                    );

                    fs.unlinkSync(req.file.path);

                    res.json({
                        message: 'Quiz generated and stored successfully',
                        quiz_id: result.insertId,
                        course_id: course_id,
                        course_title: courseTitle,
                        access_code,
                        quiz: generatedQuiz,
                        pdf_content: pdfText // Include PDF content in response
                    });
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    } catch (err) {
        console.error('🔥 Error in quiz generation:', err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Quiz generation failed: ' + err.message });
    }
});

const extractTextFromPdf = async (pdfPath) => {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        
        // Check if it's a text file (for testing purposes)
        const fileExtension = pdfPath.toLowerCase().split('.').pop();
        if (fileExtension === 'txt') {
            return dataBuffer.toString('utf8');
        }
        
        // Otherwise, treat as PDF
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (error) {
        console.error('📄 PDF extraction error:', error);
        throw new Error('Failed to extract text from PDF');
    }
};

router.get('/access/:code', authMiddleware, async (req, res) => {
    const access_code = req.params.code;

    try {
        const [quiz] = await db.execute(
            'SELECT id, title, questions, duration_minutes FROM quizzes WHERE access_code = ?',
            [access_code]
        );

        if (!quiz.length) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.json(quiz[0]);
    } catch (err) {
        console.error('❌ Fetch quiz error:', err);
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
});

router.post('/submit', authMiddleware, async (req, res) => {
    const { quiz_id, answers, is_preview = false } = req.body;
    const student_id = req.user.id;

    try {
        // Check if student has already attempted this quiz (only for non-preview submissions)
        if (!is_preview) {
            const [existingSubmissions] = await db.execute(
                `SELECT id FROM quiz_submissions WHERE quiz_id = ? AND student_id = ?`,
                [quiz_id, student_id]
            );

            if (existingSubmissions.length > 0) {
                return res.status(400).json({ 
                    error: 'You have already attempted this quiz. Each quiz can only be taken once.',
                    hasAttempted: true
                });
            }
        }

        const [quiz] = await db.execute(
            'SELECT questions FROM quizzes WHERE id = ?',
            [quiz_id]
        );

        if (!quiz.length) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const questionsRaw = quiz[0].questions;
        let questions;
        
        // Try to parse as JSON first (new format)
        try {
            questions = JSON.parse(questionsRaw);
        } catch (e) {
            // Fallback to old format parsing
            questions = questionsRaw.split(/\r?\n\r?\n/).filter(q => q.trim());
        }

        let score = 0;
        let correctAnswers = [];

        if (Array.isArray(questions)) {
            // New JSON format
            correctAnswers = questions.map(q => q.answer || null);
        } else {
            // Old format
            correctAnswers = questions.map(q => {
                const match = q.match(/Correct Answer: ([A-D])/);
                return match ? match[1] : null;
            });
        }

        console.log('🔍 Quiz scoring debug:');
        console.log('📝 Student answers:', answers);
        console.log('✅ Correct answers:', correctAnswers);
        console.log('📊 Questions count:', correctAnswers.length);

        answers.forEach((ans, idx) => {
            if (ans && correctAnswers[idx] && ans.trim() === correctAnswers[idx].trim()) {
                score++;
                console.log(`✅ Question ${idx + 1}: Correct (${ans} === ${correctAnswers[idx]})`);
            } else {
                console.log(`❌ Question ${idx + 1}: Incorrect (${ans} !== ${correctAnswers[idx]})`);
            }
        });

        const percentage = correctAnswers.length > 0 ? (score / correctAnswers.length) * 100 : 0;
        console.log(`📊 Final score: ${score}/${correctAnswers.length} = ${percentage}%`);

        // Only store submission if it's not a preview
        if (!is_preview) {
            const [result] = await db.execute(
                `INSERT INTO quiz_submissions (quiz_id, student_id, answers, score)
                 VALUES (?, ?, ?, ?)`,
                [quiz_id, student_id, JSON.stringify(answers), score] // Store raw score instead of percentage
            );

            res.json({
                message: 'Quiz submitted successfully',
                submission_id: result.insertId,
                score: score, // Return raw score
                percentage: percentage // Also return percentage for display
            });
        } else {
            // For preview, just return the score without storing
            res.json({
                message: 'Quiz preview completed',
                score: score, // Return raw score
                percentage: percentage, // Also return percentage for display
                is_preview: true
            });
        }
    } catch (err) {
        console.error('❌ Quiz submission error:', err);
        res.status(500).json({ error: 'Something went wrong!' });
    }
});

// GET: Get student's completed quizzes
router.get('/student/completed', authMiddleware, async (req, res) => {
    const student_id = req.user.id;

    try {
        const [submissions] = await db.execute(
            `SELECT qs.*, q.title as quiz_title, q.duration_minutes, q.created_at as quiz_created_at,
                    q.questions as quiz_questions, c.title as course_name, u.username as teacher_name
             FROM quiz_submissions qs
             JOIN quizzes q ON qs.quiz_id = q.id
             JOIN courses c ON q.course_id = c.id
             JOIN users u ON q.teacher_id = u.id
             WHERE qs.student_id = ?
             ORDER BY qs.submitted_at DESC`,
            [student_id]
        );

        res.json(submissions);
    } catch (err) {
        console.error('❌ Fetch student completed quizzes error:', err);
        res.status(500).json({ error: 'Failed to fetch completed quizzes' });
    }
});

router.get('/:quiz_id/results', authMiddleware, teacherMiddleware, async (req, res) => {
    const { quiz_id } = req.params;

    try {
        const [results] = await db.execute(
            `SELECT qs.*, u.username as student_name
             FROM quiz_submissions qs
             JOIN users u ON qs.student_id = u.id
             WHERE qs.quiz_id = ?`,
            [quiz_id]
        );

        res.json(results);
    } catch (err) {
        console.error('❌ Fetch results error:', err);
        res.status(500).json({ error: 'Failed to fetch quiz results' });
    }
});

// Check if student has already attempted a quiz
router.get('/:quiz_id/attempt-status', authMiddleware, async (req, res) => {
    const { quiz_id } = req.params;
    const student_id = req.user.id;

    try {
        const [submissions] = await db.execute(
            `SELECT id, score, submitted_at FROM quiz_submissions 
             WHERE quiz_id = ? AND student_id = ?`,
            [quiz_id, student_id]
        );

        if (submissions.length > 0) {
            res.json({
                hasAttempted: true,
                submission: submissions[0],
                message: 'Student has already attempted this quiz'
            });
        } else {
            res.json({
                hasAttempted: false,
                message: 'Student has not attempted this quiz yet'
            });
        }
    } catch (err) {
        console.error('❌ Check quiz attempt status error:', err);
        res.status(500).json({ error: 'Failed to check quiz attempt status' });
    }
});

// YouTube API integration for educational video suggestions

// Function to extract topics and keywords from PDF content
function extractTopicsFromPdfContent(pdfContent) {
    if (!pdfContent || typeof pdfContent !== 'string') {
        return ['computer_science']; // Default fallback
    }
    
    const content = pdfContent.toLowerCase();
    const topics = [];
    
    // Enhanced topic detection with more specific keywords
    const topicKeywords = {
        'computer_science': [
            'programming', 'coding', 'algorithm', 'data structure', 'software', 'computer', 'code', 
            'javascript', 'python', 'java', 'c\\+\\+', 'html', 'css', 'database', 'sql', 'api', 
            'web development', 'app development', 'mobile app', 'frontend', 'backend', 'full stack',
            'object oriented', 'oop', 'recursion', 'sorting', 'searching', 'binary tree', 'linked list',
            'stack', 'queue', 'hash table', 'graph', 'tree', 'array', 'string', 'function', 'class',
            'variable', 'loop', 'condition', 'if statement', 'for loop', 'while loop'
        ],
        'web_development': [
            'html', 'css', 'javascript', 'react', 'angular', 'vue', 'node.js', 'php', 'mysql', 'mongodb',
            'api', 'rest', 'graphql', 'frontend', 'backend', 'full stack', 'responsive', 'bootstrap',
            'jquery', 'ajax', 'json', 'xml', 'http', 'https', 'domain', 'hosting', 'deployment',
            'website', 'web page', 'web application', 'user interface', 'ui', 'ux', 'design'
        ],
        'data_science': [
            'data science', 'analytics', 'statistics', 'machine learning', 'data mining',
            'data visualization', 'sql', 'python', 'r', 'excel', 'tableau', 'power bi', 'regression',
            'classification', 'clustering', 'neural network', 'deep learning', 'artificial intelligence',
            'data analysis', 'data cleaning', 'data modeling', 'predictive modeling',
            'business intelligence', 'dashboard', 'reporting', 'statistical analysis',
            'data scientist', 'data analyst', 'predictive analytics', 'descriptive analytics'
        ],
        'big_data': [
            'big data', 'volume', 'velocity', 'variety', 'veracity', 'hadoop', 'spark', 'distributed computing',
            'petabytes', 'exabytes', 'data storage', 'data processing', 'real-time analytics', 'data challenges',
            'unstructured data', 'semi-structured data', 'structured data', 'data integration', 'data quality',
            'data security', 'data privacy', 'compliance', 'gdpr', 'hipaa', 'data governance', 'data lake',
            'data warehouse', 'etl processes', 'batch processing', 'stream processing', 'data pipeline',
            '4 vs', 'four vs', 'challenges of big data', 'big data challenges', 'data scalability',
            'data complexity', 'data veracity', 'data variety', 'data velocity', 'data volume'
        ],
        'artificial_intelligence': [
            'ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
            'algorithm', 'computer vision', 'natural language processing',
            'nlp', 'tensorflow', 'pytorch', 'scikit-learn', 'supervised learning', 'unsupervised learning',
            'reinforcement learning', 'feature extraction',
            'model training', 'model evaluation', 'overfitting', 'underfitting', 'cross validation',
            'artificial neural network', 'deep neural network', 'convolutional neural network', 'rnn', 'lstm'
        ],
        'cybersecurity': [
            'security', 'cybersecurity', 'encryption', 'hacking', 'firewall', 'virus', 'malware',
            'network security', 'information security', 'cryptography', 'authentication', 'authorization',
            'penetration testing', 'vulnerability', 'threat', 'risk', 'compliance', 'privacy',
            'data protection', 'secure coding', 'ssl', 'tls', 'https', 'password', 'biometric',
            'access control', 'intrusion detection', 'security audit', 'incident response'
        ],
        'electrical_engineering': [
            'circuit', 'voltage', 'current', 'resistance', 'ohm', 'watt', 'electricity', 'electronics',
            'transistor', 'capacitor', 'inductor', 'semiconductor', 'microcontroller', 'arduino',
            'raspberry pi', 'sensor', 'motor', 'generator', 'power', 'energy', 'signal', 'frequency',
            'amplifier', 'oscillator', 'filter', 'digital', 'analog', 'logic gate', 'boolean'
        ],
        'mechanical_engineering': [
            'mechanics', 'force', 'motion', 'energy', 'power', 'torque', 'gear', 'pulley', 'lever',
            'machine', 'engine', 'turbine', 'pump', 'valve', 'bearing', 'spring', 'hydraulics',
            'pneumatics', 'thermodynamics', 'heat transfer', 'fluid mechanics', 'statics', 'dynamics',
            'kinematics', 'kinetics', 'materials', 'stress', 'strain', 'fatigue', 'design'
        ],
        'mathematics': [
            'math', 'mathematics', 'algebra', 'calculus', 'geometry', 'trigonometry', 'equation',
            'formula', 'derivative', 'integral', 'matrix', 'vector', 'statistics', 'probability',
            'linear algebra', 'differential equation', 'function', 'limit', 'continuity', 'optimization',
            'graph theory', 'number theory', 'discrete mathematics', 'combinatorics', 'set theory'
        ],
        'physics': [
            'physics', 'mechanics', 'thermodynamics', 'electromagnetism', 'optics', 'wave', 'particle',
            'quantum', 'relativity', 'force', 'energy', 'momentum', 'acceleration', 'velocity', 'mass',
            'weight', 'gravity', 'electric field', 'magnetic field', 'light', 'sound', 'heat', 'temperature',
            'pressure', 'density', 'frequency', 'wavelength', 'amplitude', 'oscillation'
        ]
    };
    
    // Count keyword matches for each topic
    const topicScores = {};
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
        let score = 0;
        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = content.match(regex);
            if (matches) {
                score += matches.length;
            }
        }
        if (score > 0) {
            topicScores[topic] = score;
        }
    }
    
    // Sort topics by score and return only the top 1 most relevant topic
    const sortedTopics = Object.entries(topicScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 1) // Only take the top 1 topic
        .map(([topic]) => topic);
    
    console.log('🎯 Detected topics:', sortedTopics);
    console.log('📊 Topic scores:', topicScores);
    
    // Only return topics if they have a significant score (at least 3 matches)
    const relevantTopics = sortedTopics.filter(topic => topicScores[topic] >= 3);
    
    if (relevantTopics.length > 0) {
        return relevantTopics;
    } else if (sortedTopics.length > 0) {
        // If no topic has enough matches, return the highest scoring one anyway
        return sortedTopics;
    } else {
        // If no topics found, try to extract general subject areas
        if (content.includes('big data') || content.includes('volume') || content.includes('velocity') || content.includes('variety') || content.includes('veracity')) {
            return ['big_data'];
        } else if (content.includes('programming') || content.includes('code') || content.includes('software')) {
            return ['computer_science'];
        } else if (content.includes('web') || content.includes('html') || content.includes('css')) {
            return ['web_development'];
        } else if (content.includes('data') || content.includes('analysis') || content.includes('statistics')) {
            return ['data_science'];
        } else {
            return ['big_data']; // Default fallback for Big Data content
        }
    }
}

// Function to extract key terms from PDF context for better video search
function extractKeyTermsFromContext(contextText) {
    if (!contextText || typeof contextText !== 'string') {
        return [];
    }
    
    // Remove common words and extract meaningful terms
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
        'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
        'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
        'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'which', 'who', 'when', 'where',
        'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
        'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now'
    ]);
    
    // Extract words that are likely to be technical terms
    const words = contextText.toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word)); // Filter short words and stop words
    
    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Sort by frequency and return top terms
    const sortedTerms = Object.entries(wordCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10) // Top 10 terms
        .map(([word]) => word);
    
    return sortedTerms;
}

// Function to extract engineering and technology topics from quiz questions
function extractTopicsFromQuestions(questions) {
    const topics = [];
    const questionText = questions.join(' ').toLowerCase();
    
    // Engineering and Technology topics/keywords
    const topicKeywords = {
        'computer_science': ['programming', 'coding', 'algorithm', 'data structure', 'software', 'computer', 'code', 'javascript', 'python', 'java', 'c\\+\\+', 'html', 'css', 'database', 'sql', 'api', 'web development', 'app development', 'mobile app', 'frontend', 'backend', 'full stack'],
        'electrical_engineering': ['circuit', 'voltage', 'current', 'resistance', 'ohm', 'watt', 'electricity', 'electronics', 'transistor', 'capacitor', 'inductor', 'semiconductor', 'microcontroller', 'arduino', 'raspberry pi', 'sensor', 'motor', 'generator'],
        'mechanical_engineering': ['mechanics', 'force', 'motion', 'energy', 'power', 'torque', 'gear', 'pulley', 'lever', 'machine', 'engine', 'turbine', 'pump', 'valve', 'bearing', 'spring', 'hydraulics', 'pneumatics', 'thermodynamics'],
        'civil_engineering': ['structure', 'building', 'bridge', 'road', 'construction', 'concrete', 'steel', 'beam', 'column', 'foundation', 'soil', 'surveying', 'architecture', 'design', 'load', 'stress', 'strain'],
        'chemical_engineering': ['chemical', 'reaction', 'molecule', 'atom', 'compound', 'solution', 'mixture', 'catalyst', 'polymer', 'petroleum', 'refinery', 'distillation', 'filtration', 'crystallization', 'biotechnology'],
        'mathematics': ['math', 'algebra', 'calculus', 'geometry', 'trigonometry', 'equation', 'formula', 'derivative', 'integral', 'matrix', 'vector', 'statistics', 'probability', 'linear algebra', 'differential equation'],
        'physics': ['physics', 'mechanics', 'thermodynamics', 'electromagnetism', 'optics', 'wave', 'particle', 'quantum', 'relativity', 'force', 'energy', 'momentum', 'acceleration', 'velocity', 'mass', 'weight'],
        'robotics': ['robot', 'automation', 'control system', 'servo', 'actuator', 'sensor', 'microcontroller', 'arduino', 'raspberry pi', 'motor', 'gear', 'pulley', 'mechatronics', 'artificial intelligence', 'machine learning'],
        'artificial_intelligence': ['ai', 'machine learning', 'deep learning', 'neural network', 'algorithm', 'data science', 'big data', 'artificial intelligence', 'computer vision', 'natural language processing', 'nlp', 'tensorflow', 'pytorch', 'scikit-learn'],
        'cybersecurity': ['security', 'cybersecurity', 'encryption', 'hacking', 'firewall', 'virus', 'malware', 'network security', 'information security', 'cryptography', 'authentication', 'authorization', 'penetration testing'],
        'data_science': ['data science', 'big data', 'analytics', 'statistics', 'machine learning', 'data mining', 'data visualization', 'sql', 'python', 'r', 'excel', 'tableau', 'power bi', 'regression', 'classification'],
        'web_development': ['web development', 'html', 'css', 'javascript', 'react', 'angular', 'vue', 'node.js', 'php', 'mysql', 'mongodb', 'api', 'rest', 'graphql', 'frontend', 'backend', 'full stack'],
        'mobile_development': ['mobile app', 'android', 'ios', 'react native', 'flutter', 'swift', 'kotlin', 'java', 'mobile development', 'app development', 'smartphone', 'tablet'],
        'cloud_computing': ['cloud', 'aws', 'azure', 'google cloud', 'virtualization', 'docker', 'kubernetes', 'microservices', 'serverless', 'saas', 'paas', 'iaas', 'devops', 'ci/cd']
    };
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(keyword => questionText.includes(keyword))) {
            topics.push(topic);
        }
    }
    
    // If no specific engineering topics found, default to computer science
    return topics.length > 0 ? topics : ['computer_science'];
}

// GET: Test YouTube API endpoint
router.get('/test-youtube', async (req, res) => {
    try {
        const youtubeApiKey = process.env.YOUTUBE_API_KEY;
        console.log('🔍 Testing YouTube API...');
        console.log('🔑 API Key available:', !!youtubeApiKey);
        console.log('🔑 API Key length:', youtubeApiKey ? youtubeApiKey.length : 0);
        
        if (!youtubeApiKey) {
            return res.status(500).json({ 
                error: 'YouTube API key not configured',
                message: 'Please add YOUTUBE_API_KEY to your .env file'
            });
        }
        
        // Test with a simple search
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                q: 'programming tutorial',
                type: 'video',
                maxResults: 3,
                key: youtubeApiKey
            }
        });
        
        console.log('✅ YouTube API test successful!');
        res.json({
            success: true,
            message: 'YouTube API is working correctly',
            videosFound: response.data.items.length,
            sampleVideos: response.data.items.map(item => ({
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                url: `https://www.youtube.com/watch?v=${item.id.videoId}`
            }))
        });
        
    } catch (error) {
        console.error('❌ YouTube API test failed:', error.message);
        res.status(500).json({
            error: 'YouTube API test failed',
            message: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

// GET: Get YouTube video suggestions based on quiz topics
router.get('/:quiz_id/video-suggestions', authMiddleware, async (req, res) => {
    const { quiz_id } = req.params;
    const rawContext = (req.query.context || '').toString().toLowerCase().slice(0, 500);
    
    try {
        console.log('🔍 Fetching video suggestions for quiz:', quiz_id);
        
        // Use JavaScript-based topic extraction (no SQL queries)
        let topics = ['web_development', 'computer_science']; // Default fallback
        let contextText = rawContext;
        
        console.log('🔍 Using JavaScript-based topic extraction (no SQL queries)');
        
        // Extract topics from the provided context text
        if (contextText) {
            console.log('📄 Extracting topics from provided context...');
            const extractedTopics = extractTopicsFromPdfContent(contextText);
            console.log('🎯 Topics extracted from context:', extractedTopics);
            
            if (extractedTopics.length > 0) {
                topics = extractedTopics;
            } else {
                console.log('⚠️ No topics extracted from context, using default topics');
            }
        } else {
            console.log('📄 No context provided, using default topics');
        }
        
        console.log('🏷️ Using topics:', topics);
        if (contextText) {
            console.log('🧠 Using context:', contextText.substring(0, 120) + (contextText.length > 120 ? '...' : ''));
        }
        
        // Enhanced topic mapping for YouTube search queries with more specific terms
        const topicMapping = {
            'computer_science': 'computer science programming fundamentals tutorial',
            'electrical_engineering': 'electrical engineering circuits electronics tutorial',
            'mechanical_engineering': 'mechanical engineering thermodynamics tutorial',
            'civil_engineering': 'civil engineering structural analysis tutorial',
            'chemical_engineering': 'chemical engineering process design tutorial',
            'mathematics': 'engineering mathematics calculus tutorial',
            'physics': 'engineering physics mechanics tutorial',
            'robotics': 'robotics automation engineering tutorial',
            'artificial_intelligence': 'artificial intelligence machine learning deep learning tutorial',
            'cybersecurity': 'cybersecurity network security tutorial',
            'data_science': 'data science big data analytics tutorial',
            'big_data': 'big data hadoop spark analytics challenges tutorial',
            'web_development': 'web development html css javascript tutorial',
            'mobile_development': 'mobile app development react native tutorial',
            'cloud_computing': 'cloud computing aws azure tutorial'
        };
        
        // YouTube Data API v3 endpoint
        const youtubeApiKey = process.env.YOUTUBE_API_KEY;
        if (!youtubeApiKey) {
            console.error('❌ YouTube API key not configured');
            return res.status(500).json({ error: 'YouTube API key not configured. Please check your .env file.' });
        }

        console.log('🔑 YouTube API key available:', !!youtubeApiKey);
        console.log('🔑 YouTube API key length:', youtubeApiKey ? youtubeApiKey.length : 0);

        // Fetch videos for all detected topics (up to 3 topics to avoid API quota issues)
        const maxTopics = Math.min(topics.length, 3);
        const selectedTopics = topics.slice(0, maxTopics);
        let allVideos = [];
        
        console.log(`🔍 Fetching videos for ${selectedTopics.length} topics:`, selectedTopics);
        
        for (const topic of selectedTopics) {
            // Create more specific search queries based on PDF content
            let searchQuery = topicMapping[topic] || topic + ' tutorial';
            
            if (contextText) {
                // Extract key terms from PDF content for more specific searches
                const keyTerms = extractKeyTermsFromContext(contextText);
                
                if (keyTerms.length > 0) {
                    // Create a more specific search query using PDF content terms
                    const specificTerms = keyTerms.slice(0, 3).join(' ');
                    searchQuery = `${specificTerms} ${topic} tutorial explained`;
                } else if (contextText.includes('big data')) {
                    searchQuery = 'big data challenges overview tutorial';
                } else if (contextText.length > 0) {
                    // Use a trimmed slice of context to guide search
                    const contextSlice = contextText.replace(/\s+/g, ' ').slice(0, 120);
                    searchQuery = `${contextSlice} tutorial`;
                }
            }
            console.log(`🔍 YouTube search query for ${topic}:`, searchQuery);
            
            try {
                const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                    params: {
                        part: 'snippet',
                        q: searchQuery,
                        type: 'video',
                        maxResults: 3, // Reduced to 3 per topic to get variety
                        videoDuration: 'medium', // 4-20 minutes
                        videoEmbeddable: true,
                        relevanceLanguage: 'en',
                        videoCategoryId: '28', // Science & Technology category
                        order: 'relevance', // Most relevant first
                        key: youtubeApiKey
                    }
                });
                
                const topicVideos = response.data.items.map(item => ({
                    id: item.id.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    thumbnail: item.snippet.thumbnails.medium.url,
                    channelTitle: item.snippet.channelTitle,
                    publishedAt: item.snippet.publishedAt,
                    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                    topic: topic // Add topic information to each video
                }));
                
                allVideos = allVideos.concat(topicVideos);
                console.log(`✅ Found ${topicVideos.length} videos for ${topic}`);
                
            } catch (error) {
                console.error(`❌ Error fetching videos for ${topic}:`, error.message);
                // Continue with other topics even if one fails
            }
        }
        
        // Limit total videos to 8 to avoid overwhelming the user
        allVideos = allVideos.slice(0, 8);
        console.log(`✅ Total videos found: ${allVideos.length}`);

        console.log('✅ YouTube API response received, videos found:', allVideos.length);

        const videos = allVideos.map(video => ({
            id: video.id,
            title: video.title,
            description: video.description,
            thumbnail: video.thumbnail,
            channelTitle: video.channelTitle,
            publishedAt: video.publishedAt,
            url: video.url,
            topic: video.topic // Include topic information
        }));

        // Convert topic names to user-friendly format
        const topicDisplayNames = {
            'computer_science': 'Computer Science & Programming',
            'electrical_engineering': 'Electrical Engineering',
            'electronics-engineering': 'Electronics Engineering',
            'Biomedical_engineering': 'Biomedical Engineering',
            'mechanical_engineering': 'Mechanical Engineering',
            'civil_engineering': 'Civil Engineering',
            'chemical_engineering': 'Chemical Engineering',
            'mathematics': 'Engineering Mathematics',
            'physics': 'Engineering Physics',
            'robotics': 'Robotics & Automation',
            'artificial_intelligence': 'Artificial Intelligence & ML',
            'cybersecurity': 'Cybersecurity',
            'data_science': 'Data Science & Analytics',
            'web_development': 'Web Development',
            'mobile_development': 'Mobile Development',
            'cloud_computing': 'Cloud Computing'
        };

        const displayTopics = topics.map(topic => topicDisplayNames[topic] || topic);

        console.log('📤 Sending response with', videos.length, 'videos');

        res.json({
            topics: displayTopics,
            videos: videos
        });

    } catch (err) {
        console.error('❌ YouTube API error:', err);
        
        // More detailed error handling
        if (err.response) {
            console.error('❌ YouTube API response error:', err.response.status, err.response.data);
            if (err.response.status === 403) {
                console.log('⚠️ YouTube API access denied, returning empty video suggestions');
                
                const topicDisplayNames = {
                    'computer_science': 'Computer Science & Programming',
                    'web_development': 'Web Development',
                    'artificial_intelligence': 'Artificial Intelligence & ML',
                    'data_science': 'Data Science & Analytics',
                    'big_data': 'Big Data & Analytics',
                    'cybersecurity': 'Cybersecurity'
                };
                
                const displayTopics = topics.map(topic => topicDisplayNames[topic] || topic);
                
                return res.json({
                    topics: displayTopics,
                    videos: [],
                    fallback: true,
                    message: 'No videos available due to API limitations'
                });
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch video suggestions. Please try again later.' 
        });
    }
});

module.exports = router;