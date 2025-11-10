import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import WebcamProctoring from '../components/WebcamProctoring';
import CodeRunner from '../components/CodeRunner';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  type?: 'mcq' | 'code';
  language?: string;
  starterCode?: string;
}

interface QuizSettings {
  preventTabSwitch: boolean;
  randomizeQuestions: boolean;
  showOneQuestionAtATime: boolean;
  requireWebcam: boolean;
  duration: number; // in minutes
  passingScore: number; // percentage needed to pass
}

// Types for YouTube video suggestions
interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  topic?: string;
}

interface VideoSuggestions {
  topics: string[];
  videos: YouTubeVideo[];
  fallback?: boolean;
  message?: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  settings: QuizSettings;
  source?: string;
  pdfContent?: string; // PDF content for video suggestions
}

// Add the missing utility functions
/**
 * Shuffles an array randomly
 * @param array The array to shuffle
 * @returns A new shuffled array
 */
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

/**
 * Gets a sample quiz for demonstration purposes
 * @param quizId The ID of the quiz to generate
 * @returns A sample quiz object
 */
const getSampleQuiz = (quizId: string | undefined): Quiz => {
  return {
    id: quizId || 'sample-quiz',
    title: 'Sample Quiz',
    description: 'This is a sample quiz for demonstration purposes.',
    questions: [
      {
        id: 1,
        question: 'What is the capital of France?',
        options: ['London', 'Berlin', 'Paris', 'Madrid'],
        correctAnswer: 'Paris'
      },
      {
        id: 2,
        question: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4'
      },
      {
        id: 3,
        question: 'Who painted the Mona Lisa?',
        options: ['Van Gogh', 'Da Vinci', 'Picasso', 'Monet'],
        correctAnswer: 'Da Vinci'
      },
      {
        id: 4,
        question: 'Which planet is closest to the sun?',
        options: ['Earth', 'Mars', 'Venus', 'Mercury'],
        correctAnswer: 'Mercury'
      },
      {
        id: 5,
        question: 'What is the largest mammal?',
        options: ['Elephant', 'Blue Whale', 'Giraffe', 'Hippopotamus'],
        correctAnswer: 'Blue Whale'
      }
    ],
    settings: {
      preventTabSwitch: true,
      randomizeQuestions: true,
      showOneQuestionAtATime: true,
      requireWebcam: false,
      duration: 5, // 5 minutes
      passingScore: 60
    },
    source: 'sample'
  };
};

const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const webcamRef = useRef<HTMLVideoElement>(null);
  
  // Define states with proper types
  const [loading, setLoading] = useState<boolean>(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizStarted, setQuizStarted] = useState<boolean>(false);
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [webcamReady, setWebcamReady] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [violations, setViolations] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [showScore, setShowScore] = useState(false);
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    preventTabSwitch: true,
    randomizeQuestions: true,
    showOneQuestionAtATime: true,
    requireWebcam: false,
    duration: 5, // 5 minutes
    passingScore: 60
  });
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [quizCode, setQuizCode] = useState<string | null>(null);
  const [invalidAccess, setInvalidAccess] = useState(false);
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [quizDescription, setQuizDescription] = useState<string>('');
  const userRole = localStorage.getItem('userRole');

  // State for YouTube recommendations shown on the in-page results
  const [videoSuggestions, setVideoSuggestions] = useState<VideoSuggestions | null>(null);
  const [loadingVideos, setLoadingVideos] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState<boolean>(false);
  const [hasAlreadyAttempted, setHasAlreadyAttempted] = useState<boolean>(false);
  const [attemptStatus, setAttemptStatus] = useState<any>(null);

  // Function to check if student has already attempted this quiz
  const checkQuizAttemptStatus = async (quizId: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/${quizId}/attempt-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.hasAttempted) {
          setHasAlreadyAttempted(true);
          setAttemptStatus(data.submission);
          console.log('🚫 Student has already attempted this quiz:', data.submission);
        }
      }
    } catch (error) {
      console.error('Error checking quiz attempt status:', error);
    }
  };

  useEffect(() => {
    console.log('QuizPage: quizId', quizId);
    console.log('QuizPage: generatedQuizzes', localStorage.getItem('generatedQuizzes'));
    
    // Check if this is a preview mode
    const urlParams = new URLSearchParams(location.search);
    const previewMode = urlParams.get('preview') === 'true';
    setIsPreview(previewMode);
    
    // Check if the user is logged in
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/login');
      return;
    }
    
    setLoading(true);
    
    // First try to load from backend
    const loadQuizFromBackend = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token && quizId) {
          // Try teacher-quizzes endpoint first (for teacher-created quizzes)
          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/teacher-quizzes`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const teacherQuizzes = await response.json();
            const foundQuiz = teacherQuizzes.find((q: any) => q.id.toString() === quizId);
            
            if (foundQuiz) {
              let questions = [];
              if (foundQuiz.questions) {
                if (typeof foundQuiz.questions === 'string') {
                  try {
                    questions = JSON.parse(foundQuiz.questions);
                  } catch (error) {
                    console.error('Error parsing questions JSON:', error);
                    questions = [];
                  }
                } else if (Array.isArray(foundQuiz.questions)) {
                  questions = foundQuiz.questions;
                }
              }
              
              const backendQuiz = {
                id: foundQuiz.id.toString(),
                title: foundQuiz.title,
                description: `Quiz for ${foundQuiz.course_name}`,
                questions: questions,
                code: foundQuiz.access_code,
                quizCode: foundQuiz.access_code,
                duration: foundQuiz.duration_minutes,
                createdAt: foundQuiz.created_at,
                source: foundQuiz.is_auto_generated ? 'pdf-content' : 'manual',
                settings: {
                  timeLimit: foundQuiz.duration_minutes,
                  preventTabSwitch: true,
                  randomizeQuestions: true,
                  showOneQuestionAtATime: true,
                  requireWebcam: false
                }
              };
              
              return backendQuiz;
            }
          }
        }
      } catch (error) {
        console.error('Error loading quiz from backend:', error);
      }
      return null;
    };
    
    // Attempt to find the quiz in localStorage first
    const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
    const foundQuiz = generatedQuizzes.find((q: any) => q.id === quizId);
    
    // Also check student scheduled quizzes
    const studentQuizzes = JSON.parse(localStorage.getItem('studentScheduledQuizzes') || '[]');
    const foundStudentQuiz = studentQuizzes.find((q: any) => q.id === quizId);
    
    console.log('QuizPage: foundQuiz', foundQuiz);
    console.log('QuizPage: foundStudentQuiz', foundStudentQuiz);
    
    // Try backend first, then fallback to localStorage
    loadQuizFromBackend().then((backendQuiz) => {
      const quiz = backendQuiz || foundQuiz || foundStudentQuiz;
      
      if (quiz) {
        setTimeout(() => {
        // Set up the quiz with settings
        const quizData: Quiz = {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description || '',
          questions: quiz.questions.map((q: any, idx: number) => {
            // Handle code questions
            if (q.type === 'code') {
              return {
                id: q.id || idx + 1,
                question: q.question,
                type: 'code',
                language: q.language || 'python',
                starterCode: q.starterCode || '',
                testCases: q.testCases || [],
                options: [], // Code questions don't have options
                correctAnswer: q.answer || '' // Expected output for code
              };
            }
            
            // Handle MCQ questions
            const options = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? q.options.split(',') : []);
            const answerLetter = q.correctAnswer || q.answer;
            
            // Convert letter answer (A, B, C, D) to actual option text
            let correctAnswer = answerLetter;
            if (answerLetter && options.length > 0) {
              const letterIndex = answerLetter.charCodeAt(0) - 65; // Convert A=0, B=1, C=2, D=3
              if (letterIndex >= 0 && letterIndex < options.length) {
                correctAnswer = options[letterIndex];
              }
            }
            
            return {
              id: q.id || idx + 1,
              question: q.question,
              type: q.type || 'mcq',
              options: options,
              correctAnswer: correctAnswer
            };
          }),
          settings: {
            duration: Number(quiz.settings?.timeLimit || quiz.duration || 20),
            preventTabSwitch: !!quiz.settings?.preventTabSwitch || false,
            randomizeQuestions: !!quiz.settings?.randomizeQuestions || false,
            showOneQuestionAtATime: !!quiz.settings?.showOneQuestionAtATime || false,
            requireWebcam: !!quiz.settings?.requireWebcam || false,
            passingScore: quiz.settings?.passingScore || 60
          },
          source: quiz.source || 'manual'
        };
        console.log('QuizPage: quizData to set', quizData);
        
        setQuiz(quizData);
        
        // Check if student has already attempted this quiz (only for students, not teachers in preview mode)
        if (userRole === 'student' && !previewMode && quizId) {
          checkQuizAttemptStatus(quizId);
        }
        
        // Initialize questions
        let questionsToUse = [...quizData.questions];
        if (quizData.settings.randomizeQuestions) {
          questionsToUse = shuffleArray([...questionsToUse]);
        }
        
        setQuestions(questionsToUse);
        setCurrentQuestion(questionsToUse[0] || null);
        setSelectedAnswers({});
        setLoading(false);
        setQuizStarted(false);
        
        // If in preview mode and has PDF content, fetch video suggestions immediately
        if (previewMode && quizData && (quizData.pdfContent || quizData.source === 'pdf-content')) {
          fetchVideoRecommendations(quizData.id);
        }
        
        // In preview mode, automatically start the quiz to show questions
        if (previewMode) {
          setQuizStarted(true);
        }
        }, 1500);
      } else {
        // For demo purposes, load a sample quiz if not found
        setTimeout(() => {
          const sampleQuiz = getSampleQuiz(quizId);
          setQuiz(sampleQuiz);
          
          // Initialize questions
          let questionsToUse = [...sampleQuiz.questions];
          if (sampleQuiz.settings.randomizeQuestions) {
            questionsToUse = shuffleArray([...questionsToUse]);
          }
          
          setQuestions(questionsToUse);
          setCurrentQuestion(questionsToUse[0] || null);
          setSelectedAnswers({});
          setLoading(false);
          setQuizStarted(false);
        }, 1500);
      }
    });
  }, [quizId, navigate]);
  
  // Add tab visibility change detection
  useEffect(() => {
    if (quizSettings.preventTabSwitch && !loading && !showScore) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          handleViolation('tab_switch');
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [loading, showScore, quizSettings.preventTabSwitch]);
  
  // Timer effect
  useEffect(() => {
    if (quizStarted && !loading && !showScore && timeLeft > 0) {
      const timerId = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    } else if (quizStarted && timeLeft === 0 && !showScore) {
      handleSubmitQuiz();
    }
  }, [timeLeft, loading, showScore, quizStarted]);
  
  const handleViolation = (type: string) => {
    setViolations(prev => [...prev, type]);
    setShowViolationWarning(true);
    
    // Hide the warning after 5 seconds
    setTimeout(() => {
      setShowViolationWarning(false);
    }, 5000);
    
    // In a real app, we would also log this to the server
    console.warn(`Violation detected: ${type}`);
  };
  
  const handleAnswerSelection = (option: string) => {
    if (!currentQuestion) return;
    setSelectedAnswer(option);
    setShowExplanation(false);
    // Save the answer immediately for the current question id
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: option
    }));
  };
  
  const handleNextQuestion = () => {
    if (!currentQuestion) return;
    // No need to setSelectedAnswers here, it's handled in handleAnswerSelection
    // Check if the answer is correct
    if (selectedAnswer?.trim() === currentQuestion.correctAnswer?.trim()) {
      setScore(score + 1);
    }
    setSelectedAnswer('');
    setShowExplanation(false);
    // Move to next question or end quiz
    const nextQuestionIndex = currentQuestionIndex + 1;
    if (nextQuestionIndex < questions.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      setCurrentQuestion(questions[nextQuestionIndex]);
      // Restore previous answer if any
      setSelectedAnswer(selectedAnswers[questions[nextQuestionIndex].id] || '');
    } else {
      handleSubmitQuiz();
    }
  };
  
  const handleSubmitQuiz = async () => {
    if (!showScore) {
      // Save the last answer if not already saved
      if (currentQuestion && selectedAnswer) {
        setSelectedAnswers(prev => ({
          ...prev,
          [currentQuestion.id]: selectedAnswer
        }));
      }
      
      // Calculate the final score by checking all selected answers against correct answers
      const calculateFinalScore = () => {
        let finalScore = 0;
        const allAnswers = {
          ...selectedAnswers,
          ...(currentQuestion && selectedAnswer ? { [currentQuestion.id]: selectedAnswer } : {})
        };
        
        questions.forEach(question => {
          const userAnswer = allAnswers[question.id];
          if (userAnswer && userAnswer.trim() === question.correctAnswer.trim()) {
            finalScore++;
          }
        });
        
        return finalScore;
      };
      
      // Submit quiz to backend API
      if (quiz) {
        const finalScore = calculateFinalScore();
        const allAnswers = {
          ...selectedAnswers,
          ...(currentQuestion && selectedAnswer ? { [currentQuestion.id]: selectedAnswer } : {})
        };
        
        // Convert answers to array format expected by backend
        // Convert selected option text back to letter answers (A, B, C, D)
        const answersArray = questions.map(question => {
          const selectedText = allAnswers[question.id] || '';
          if (!selectedText) return '';
          
          // Find the index of the selected option in the question's options array
          const optionIndex = question.options.findIndex(option => option === selectedText);
          if (optionIndex >= 0) {
            // Convert index to letter (0=A, 1=B, 2=C, 3=D)
            return String.fromCharCode(65 + optionIndex);
          }
          return '';
        });
        
        try {
          // Determine if this is a preview (teacher) or actual submission (student)
          const urlParams = new URLSearchParams(location.search);
          const isPreview = urlParams.get('preview') === 'true';
          
          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
              quiz_id: quiz.id,
              answers: answersArray,
              is_preview: isPreview
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('Quiz submitted successfully:', result);
            
            // Update the score state to match the final calculated score
            setScore(finalScore);
            
            // Only save to localStorage if it's not a preview (for backward compatibility)
            if (!isPreview) {
              const completedQuiz = {
                id: quiz.id,
                title: quiz.title,
                description: quiz.description,
                completedDate: new Date().toISOString(),
                duration: quiz.settings.duration,
                quizCode: quiz.id,
                questions: quiz.questions,
                courseId: quiz.source,
                courseName: quiz.source,
                source: quiz.source,
                score: finalScore,
                totalQuestions: questions.length,
                selectedAnswers: allAnswers
              };
              
              // Save to completed quizzes for backward compatibility
              const existingCompletedQuizzes = JSON.parse(localStorage.getItem('completedQuizzes') || '[]');
              const filtered = existingCompletedQuizzes.filter((q: any) => q.id !== completedQuiz.id || q.completedDate !== completedQuiz.completedDate);
              const updatedCompletedQuizzes = [...filtered, completedQuiz];
              localStorage.setItem('completedQuizzes', JSON.stringify(updatedCompletedQuizzes));
              
              console.log('Saved completed quiz to localStorage:', completedQuiz);
            } else {
              console.log('Quiz preview completed - not saved to database');
            }
          } else {
            console.error('Failed to submit quiz:', await response.text());
            // Fallback to localStorage if API fails
            const finalScore = calculateFinalScore();
            setScore(finalScore);
          }
        } catch (error) {
          console.error('Error submitting quiz:', error);
          // Fallback to localStorage if API fails
          const finalScore = calculateFinalScore();
          setScore(finalScore);
        }
      }
      
      // In preview mode, don't show results - just show questions with videos
      if (!isPreview) {
        setShowScore(true);
        setQuizCompleted(true); // Ensure results are shown
      }
      
      // Trigger recommendations fetch immediately after submission
      if (quiz) {
        fetchVideoRecommendations(quiz.id);
      }
    }
  };

  // Fetch YouTube recommendations (same contract as QuizResultsPage)
  const fetchVideoRecommendations = async (resultsQuizId: string) => {
    try {
      setLoadingVideos(true);
      setVideoError(null);

      const token = localStorage.getItem('authToken');
      if (!token || typeof token !== 'string' || token.trim() === '') {
        setVideoError('Authentication required. Please login again.');
        return;
      }

      const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/$/, '');
      // Build context from the current quiz state for better relevance
      const contextPieces: string[] = [];
      if (quiz?.title) contextPieces.push(quiz.title);
      
      // Add PDF content if available (from localStorage or quiz data)
      if (quiz?.pdfContent) {
        contextPieces.push(quiz.pdfContent);
      } else if (quiz?.source) {
        // Try to get PDF content from localStorage based on quiz source
        try {
          const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
          const foundQuiz = generatedQuizzes.find((q: any) => q.id === quiz.id || q.title === quiz.title);
          if (foundQuiz?.pdfContent) {
            contextPieces.push(foundQuiz.pdfContent);
          }
        } catch (_) {}
      }
      
      if (Array.isArray(quiz?.questions)) {
        try {
          const qs = (quiz?.questions || []).map((q) => q.question).join(' ');
          contextPieces.push(qs);
        } catch (_) {}
      }
      const context = encodeURIComponent(contextPieces.join(' ').slice(0, 1000)); // Increased limit for more context
      const url = `${apiBase}/api/quiz/${resultsQuizId}/video-suggestions${context ? `?context=${context}` : ''}`;

      console.log('🔍 Making API call to:', url);
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      console.log('✅ Video suggestions response:', response.data);
      setVideoSuggestions(response.data);
    } catch (error: any) {
      if (error?.response) {
        if (error.response.status === 401) {
          setVideoError('Authentication required. Please login again.');
        } else if (error.response.status === 403) {
          setVideoError('Access denied. You do not have permission to view this content.');
        } else if (error.response.status === 404) {
          setVideoError('Quiz not found.');
        } else {
          setVideoError(error.response.data?.error || 'Failed to fetch video suggestions');
        }
      } else if (error?.request) {
        setVideoError('Network error. Please check your internet connection.');
      } else {
        setVideoError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoadingVideos(false);
    }
  };
  
  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  const handleWebcamToggle = () => {
    setWebcamReady(!webcamReady);
  };
  
  const handleStartQuiz = () => {
    if (!quiz) return;
    setQuizStarted(true);
    setQuizCompleted(false);
    setTimeLeft((quiz.settings.duration || 5) * 60); // fallback to 5 min if not set
    setScore(0);
    setSelectedAnswers({});
    setSelectedAnswer('');
    setCurrentQuestionIndex(0);
    setCurrentQuestion(questions[0] || null);
    setShowExplanation(false);
    setViolations([]);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin mb-4">
              <i className="ri-loader-4-line text-4xl text-primary"></i>
            </div>
            <p className="text-gray-600">Loading quiz...</p>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }
  
  if (invalidAccess) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        
        <div className="flex-grow flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <i className="ri-lock-line text-3xl text-red-600"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
              <p className="text-gray-600">
                This quiz requires a valid access code. Please obtain the correct code from your teacher.
              </p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => navigate('/student-dashboard')}
                className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow py-8 px-4">
        {loading ? (
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-8 flex flex-col items-center justify-center">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
            <h2 className="text-xl font-bold text-gray-800">Loading Quiz...</h2>
            <p className="text-gray-600 mt-2">Please wait while we prepare your quiz</p>
          </div>
        ) : hasAlreadyAttempted ? (
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                <i className="ri-check-double-line text-3xl text-yellow-600"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-4">Quiz Already Completed</h1>
              <p className="text-gray-600 mb-6">
                You have already attempted this quiz. Each quiz can only be taken once.
              </p>
              
              {attemptStatus && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h2 className="text-lg font-medium text-gray-800 mb-4">Your Previous Attempt</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{attemptStatus.score}%</div>
                      <div className="text-sm text-gray-600">Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-800">
                        {new Date(attemptStatus.submitted_at).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-600">Date Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-800">
                        {new Date(attemptStatus.submitted_at).toLocaleTimeString()}
                      </div>
                      <div className="text-sm text-gray-600">Time Completed</div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <button
                  onClick={() => navigate('/student-dashboard')}
                  className="w-full px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                >
                  Return to Dashboard
                </button>
                <button
                  onClick={() => navigate('/quiz-results/' + quizId)}
                  className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  View Detailed Results
                </button>
              </div>
            </div>
          </div>
        ) : !quizStarted ? (
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">{quiz?.title}</h1>
            <p className="text-gray-600 mb-6">{quiz?.description}</p>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-medium text-blue-800 mb-2">Quiz Information</h2>
              <ul className="text-blue-700 space-y-2">
                <li className="flex items-center">
                  <i className="ri-question-line mr-2"></i>
                  Questions: {quiz?.questions.length}
                </li>
                <li className="flex items-center">
                  <i className="ri-time-line mr-2"></i>
                  Time Limit: {quiz?.settings.duration} minutes
                </li>
                <li className="flex items-center">
                  <i className="ri-trophy-line mr-2"></i>
                  Passing Score: {quiz?.settings.passingScore}%
                </li>
                {quiz?.source === 'pdf-content' && (
                  <li className="flex items-center">
                    <i className="ri-file-pdf-line mr-2"></i>
                    Source: Generated from PDF Content
                  </li>
                )}
              </ul>
            </div>
            
            {quiz?.settings.requireWebcam && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 mb-6">
                <h2 className="text-lg font-medium text-yellow-800 mb-2">Webcam Required</h2>
                <p className="text-yellow-700">
                  This quiz requires webcam access for proctoring. Please ensure your camera is working and allow access when prompted.
                </p>
                
                <div className="mt-4 flex justify-center">
                  <div className="w-64 h-48 bg-gray-200 border border-gray-300 rounded-lg flex items-center justify-center">
                    {webcamReady ? (
                      <video 
                        ref={webcamRef}
                        width="256"
                        height="192"
                        autoPlay
                        muted
                        className="rounded-lg"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <i className="ri-camera-off-line text-3xl text-gray-400 mb-2"></i>
                        <p className="text-gray-500 text-sm">Camera not activated</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleWebcamToggle}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {webcamReady ? 'Camera Ready' : 'Enable Camera'}
                  </button>
                </div>
              </div>
            )}
            
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h2 className="text-lg font-medium text-gray-800 mb-4">Quiz Rules</h2>
              <ul className="text-gray-600 space-y-2 list-disc pl-5">
                <li>Once you start the quiz, the timer will begin and cannot be paused.</li>
                <li>Answer all questions before submitting your quiz.</li>
                {quiz?.settings.preventTabSwitch && (
                  <li className="text-red-600">
                    <strong>Warning:</strong> Switching tabs or windows during the quiz will be recorded as a violation.
                  </li>
                )}
                {quiz?.settings.showOneQuestionAtATime && (
                  <li>Questions will be presented one at a time. You can navigate between them.</li>
                )}
                {quiz?.settings.randomizeQuestions && (
                  <li>Questions are presented in random order for each student.</li>
                )}
              </ul>
            </div>
            
            {/* Video Suggestions - PDF Content Based Only */}
            {(isPreview || quizCompleted) && (loadingVideos || videoSuggestions || videoError) && (
              <div className="mt-8 border-t pt-8">
                <h2 className="text-xl font-medium text-gray-800 mb-6 flex items-center">
                  <i className="ri-youtube-line text-red-600 mr-2 text-2xl"></i>
                  Recommended Videos for Students
                </h2>

                {loadingVideos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin mr-3">
                      <i className="ri-loader-4-line text-xl text-primary"></i>
                    </div>
                    <span className="text-gray-600">Loading video suggestions...</span>
                  </div>
                ) : videoError ? (
                  <div className="text-center py-8 text-red-500">
                    <i className="ri-error-warning-line text-4xl mb-3"></i>
                    <p className="font-medium">Failed to load video suggestions</p>
                    <p className="text-sm mt-2">{videoError}</p>
                    {quiz?.id && (
                      <button onClick={() => fetchVideoRecommendations(quiz.id)} className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors">Try Again</button>
                    )}
                  </div>
                ) : videoSuggestions && videoSuggestions.videos && videoSuggestions.videos.length > 0 && !videoSuggestions.fallback ? (
                  <div>
                    {videoSuggestions.topics.length > 0 && (
                      <p className="text-gray-600 mb-4">
                        Based on topics: <span className="font-medium text-primary">{videoSuggestions.topics.join(', ')}</span>
                      </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {videoSuggestions.videos.map((video) => (
                        <div key={video.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                          <div className="relative">
                            <img src={video.thumbnail} alt={video.title} className="w-full h-32 object-cover" />
                            <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                              <i className="ri-play-fill mr-1"></i>
                              YouTube
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="font-medium text-gray-800 mb-2 line-clamp-2">{video.title}</h3>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{video.description}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                              <span>{video.channelTitle}</span>
                              <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                            </div>
                            <a href={video.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors">
                              <i className="ri-external-link-line mr-2"></i>
                              Watch Video
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : videoSuggestions && videoSuggestions.fallback ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="ri-video-line text-4xl mb-3"></i>
                    <p className="font-medium">No videos available</p>
                    <p className="text-sm mt-2">Video recommendations are not available for this quiz.</p>
                  </div>
                ) : null}
              </div>
            )}
            
            <div className="flex justify-center mt-8">
              <button
                onClick={handleStartQuiz}
                disabled={quiz?.settings.requireWebcam && !webcamReady}
                className={`px-6 py-3 text-lg font-medium rounded-lg ${
                  quiz?.settings.requireWebcam && !webcamReady 
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                    : 'bg-primary text-white hover:bg-primary/90'
                } transition-colors`}
              >
                Start Quiz
              </button>
            </div>
          </div>
        ) : showScore ? (
          // Quiz Results
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-green-100 text-green-600 text-4xl mb-4">
                <i className="ri-check-line"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Quiz Completed!</h1>
              <p className="text-gray-600 mt-2">
                You've completed the quiz: {quiz?.title}
              </p>
            </div>
            
            <div className="mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-medium text-gray-800">Your Score</h2>
                <span className="text-2xl font-bold text-primary">
                  {score}/{questions.length} ({Math.round((score / questions.length) * 100)}%)
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div 
                  className={`h-4 rounded-full ${
                    (score / questions.length) >= (quiz?.settings.passingScore || 60) / 100 
                      ? 'bg-green-500' 
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${(score / questions.length) * 100}%` }}
                ></div>
              </div>
              
              <p className={`text-right font-medium ${
                (score / questions.length) >= (quiz?.settings.passingScore || 60) / 100 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {(score / questions.length) >= (quiz?.settings.passingScore || 60) / 100 
                  ? 'Passed!' 
                  : 'Failed'}
              </p>
            </div>
            
            {violations.length > 0 && (
              <div className="mb-8 bg-red-50 border border-red-100 rounded-lg p-4">
                <h2 className="text-lg font-medium text-red-800 mb-2">Potential Violations Detected</h2>
                <ul className="text-red-700 space-y-2">
                  {violations.map((violation, index) => (
                    <li key={index} className="flex items-start">
                      <i className="ri-error-warning-line mr-2 mt-0.5"></i>
                      <span>{violation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="space-y-6">
              <h2 className="text-xl font-medium text-gray-800 mb-4">Question Summary</h2>
              
              {questions.map((question, index) => (
                <div 
                  key={question.id} 
                  className={`border rounded-lg p-4 ${
                    selectedAnswers[question.id] === question.correctAnswer
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <h3 className="font-medium text-gray-800 mb-2">
                    {index + 1}. {question.question}
                  </h3>
                  
                  <ul className="space-y-2 mb-3">
                    {question.options.map((option) => (
                      <li
                        key={option}
                        className={`px-3 py-2 rounded ${
                          option?.trim() === question.correctAnswer?.trim()
                            ? 'bg-green-200 text-green-800'
                            : option === selectedAnswers[question.id] && option?.trim() !== question.correctAnswer?.trim()
                              ? 'bg-red-200 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {option}
                        {option?.trim() === question.correctAnswer?.trim() && (
                          <span className="float-right">
                            <i className="ri-check-line"></i>
                          </span>
                        )}
                        {option === selectedAnswers[question.id] && option?.trim() !== question.correctAnswer?.trim() && (
                          <span className="float-right">
                            <i className="ri-close-line"></i>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  
                  <div className={`text-sm font-medium ${
                    selectedAnswers[question.id]?.trim() === question.correctAnswer?.trim()
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {selectedAnswers[question.id]?.trim() === question.correctAnswer?.trim()
                      ? 'Correct'
                      : 'Incorrect - Correct answer: ' + question.correctAnswer
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* Video Suggestions in Results */}
            {(loadingVideos || videoSuggestions || videoError) && (
              <div className="mt-10 border-t pt-8">
                <h2 className="text-xl font-medium text-gray-800 mb-6 flex items-center">
                  <i className="ri-youtube-line text-red-600 mr-2 text-2xl"></i>
                  Recommended Videos for Further Learning
                </h2>

                {loadingVideos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin mr-3">
                      <i className="ri-loader-4-line text-xl text-primary"></i>
                    </div>
                    <span className="text-gray-600">Loading video suggestions...</span>
                  </div>
                ) : videoError ? (
                  <div className="text-center py-8 text-red-500">
                    <i className="ri-error-warning-line text-4xl mb-3"></i>
                    <p className="font-medium">Failed to load video suggestions</p>
                    <p className="text-sm mt-2">{videoError}</p>
                    {quiz?.id && (
                      <button onClick={() => fetchVideoRecommendations(quiz.id)} className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors">Try Again</button>
                    )}
                  </div>
                ) : videoSuggestions && videoSuggestions.videos && videoSuggestions.videos.length > 0 && !videoSuggestions.fallback ? (
                  <div>
                    {videoSuggestions.topics.length > 0 && (
                      <p className="text-gray-600 mb-4">
                        Based on topics: <span className="font-medium text-primary">{videoSuggestions.topics.join(', ')}</span>
                      </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {videoSuggestions.videos.map((video) => (
                        <div key={video.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                          <div className="relative">
                            <img src={video.thumbnail} alt={video.title} className="w-full h-32 object-cover" />
                            <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                              <i className="ri-play-fill mr-1"></i>
                              YouTube
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="font-medium text-gray-800 mb-2 line-clamp-2">{video.title}</h3>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{video.description}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                              <span>{video.channelTitle}</span>
                              <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                            </div>
                            <a href={video.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors">
                              <i className="ri-external-link-line mr-2"></i>
                              Watch Video
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : videoSuggestions && videoSuggestions.fallback ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="ri-video-line text-4xl mb-3"></i>
                    <p className="font-medium">No videos available</p>
                    <p className="text-sm mt-2">Video recommendations are not available for this quiz.</p>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex justify-center mt-8">
              <Link
                to="/student-dashboard"
                className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          // Quiz Questions
          <div className="bg-white rounded-xl shadow-md p-6">
            {/* Quiz Code Indicator */}
            {quizCode && (
              <div className="flex justify-end mb-4">
                <div className="bg-primary/10 text-primary font-mono px-3 py-1 rounded-md text-sm">
                  Quiz Code: {quizCode}
                </div>
              </div>
            )}
            
            {/* Quiz Header */}
            <div className="mb-6 pb-4 border-b">
              <h1 className="text-2xl font-bold text-gray-800">{quizTitle || 'Quiz'}</h1>
              {quizDescription && <p className="text-gray-600 mt-1">{quizDescription}</p>}
              
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="flex items-center bg-primary/10 px-4 py-2 rounded-full">
                  <i className="ri-time-line text-primary mr-2"></i>
                  <span className={`font-medium ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                
                <div className="flex items-center bg-gray-100 px-4 py-2 rounded-full">
                  <span className="text-gray-700 font-medium">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary rounded-full h-2.5 transition-all duration-300" 
                  style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>
            
            {/* Question */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">
                <span className="text-primary font-bold">Q{currentQuestionIndex + 1}:</span> {currentQuestion?.question}
              </h2>
              {currentQuestion?.type === 'code' ? (
                <div className="space-y-3">
                  <CodeRunner
                    initialLanguage={currentQuestion.language || 'python'}
                    initialCode={currentQuestion.starterCode || ''}
                    onRun={() => {}}
                    onSubmit={async (code) => {
                      try {
                        const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/$/, '');
                        const resp = await fetch(`${apiBase}/api/code/grade`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
                          },
                          body: JSON.stringify({
                            language: currentQuestion.language || 'python',
                            code,
                            testCases: (currentQuestion as any).testCases || []
                          })
                        });
                        const data = await resp.json();
                        if (!resp.ok) throw new Error(data?.error || 'Grading failed');
                        // Treat pass-all as correct for scoring
                        const passedAll = data && data.total > 0 && data.passed === data.total;
                        setSelectedAnswers(prev => ({ ...prev, [currentQuestion.id]: passedAll ? 'CORRECT_CODE' : 'WRONG_CODE' }));
                        if (passedAll) {
                          setScore(prev => prev + 1);
                          alert('All test cases passed!');
                        } else {
                          alert(`Passed ${data.passed}/${data.total} test cases.`);
                        }
                      } catch (e: any) {
                        alert(e.message || 'Grading error');
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {currentQuestion?.options.map((option, index) => (
                    <div 
                      key={index}
                      onClick={() => handleAnswerSelection(option)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedAnswer === option 
                          ? 'border-primary bg-primary/5 shadow-sm' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-5 h-5 rounded-full border flex-shrink-0 mr-3 flex items-center justify-center ${
                          selectedAnswer === option ? 'border-primary' : 'border-gray-300'
                        }`}>
                          {selectedAnswer === option && (
                            <div className="w-3 h-3 rounded-full bg-primary"></div>
                          )}
                        </div>
                        <span className={selectedAnswer === option ? 'font-medium' : ''}>{option}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Show explanation button */}
            {selectedAnswer && (
              <div className="mb-6">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-primary hover:text-primary/80 text-sm flex items-center"
                >
                  <i className={`ri-${showExplanation ? 'arrow-up' : 'arrow-down'}-s-line mr-1`}></i>
                  {showExplanation ? 'Hide hint' : 'Show hint'}
                </button>
                
                {showExplanation && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-md text-sm text-blue-800">
                    <p className="font-medium mb-1">Hint:</p>
                    <p>Think about the fundamental properties of this data structure/algorithm and its common applications.</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                onClick={() => {
                  if (currentQuestionIndex > 0) {
                    setCurrentQuestionIndex(currentQuestionIndex - 1);
                    setCurrentQuestion(questions[currentQuestionIndex - 1]);
                    setSelectedAnswer(selectedAnswers[questions[currentQuestionIndex - 1].id] || '');
                    setShowExplanation(false);
                  }
                }}
                className={`px-4 py-2 rounded-md flex items-center ${
                  currentQuestionIndex === 0 || !quizSettings.showOneQuestionAtATime
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                disabled={currentQuestionIndex === 0 || !quizSettings.showOneQuestionAtATime}
              >
                <i className="ri-arrow-left-s-line mr-1"></i>
                Previous
              </button>
              
              <button
                onClick={handleNextQuestion}
                disabled={currentQuestionIndex < questions.length - 1 && currentQuestion?.type !== 'code' && !selectedAnswer}
                className={`px-6 py-2 rounded-md ${
                  currentQuestionIndex < questions.length - 1 && currentQuestion?.type !== 'code' && !selectedAnswer
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next' : 'Finish Quiz'}
              </button>
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default QuizPage; 