
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface CompletedQuiz {
  id: string;
  title: string;
  description: string;
  completedDate: string;
  duration?: number;
  quizCode: string;
  questions?: {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
  courseId?: string;
  courseName?: string;
  source?: string;
  score: number;
  totalQuestions: number;
  selectedAnswers: Record<number, string>;
}

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  topic?: string; // Optional topic information
}

interface VideoSuggestions {
  topics: string[];
  videos: YouTubeVideo[];
  fallback?: boolean;
  message?: string;
}

const QuizResultsPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<CompletedQuiz | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [videoSuggestions, setVideoSuggestions] = useState<VideoSuggestions | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    // Check if the user is logged in
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(true);

    // Try to fetch quiz results from backend API first
    const fetchQuizFromBackend = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/student/completed`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (response.ok) {
          const completedQuizzes = await response.json();
          console.log('🔍 QuizResultsPage: completedQuizzes from backend:', completedQuizzes);
          
          // Find the specific quiz by ID
          const foundQuiz = completedQuizzes.find((q: any) => q.quiz_id.toString() === quizId);
            console.log('🔍 QuizResultsPage: foundQuiz from backend:', foundQuiz);
          
          if (foundQuiz) {
            // Parse quiz questions and answers
            let questions: any[] = [];
            let selectedAnswers: Record<number, string> = {};
            let totalQuestions = 0;
            
            try {
              // Parse quiz questions (JSON format)
              const quizQuestions = JSON.parse(foundQuiz.quiz_questions);
              questions = quizQuestions;
              totalQuestions = quizQuestions.length;
              
              // Parse submitted answers - handle array, JSON string, and comma-separated string formats
              let submittedAnswers: string[];
              if (Array.isArray(foundQuiz.answers)) {
                // Already an array
                submittedAnswers = foundQuiz.answers;
              } else if (typeof foundQuiz.answers === 'string') {
                try {
                  // Try to parse as JSON first
                  submittedAnswers = JSON.parse(foundQuiz.answers);
                } catch (error) {
                  // If JSON parsing fails, treat as comma-separated string
                  submittedAnswers = foundQuiz.answers.split(',').map((answer: string) => answer.trim());
                }
              } else {
                // Fallback
                submittedAnswers = [];
              }
              // Handle both letter answers (new format) and full text answers (old format)
              questions.forEach((question: any, index: number) => {
                const submittedAnswer = submittedAnswers[index];
                if (submittedAnswer && question.options) {
                  // Check if it's a letter answer (A, B, C, D) - new format
                  if (submittedAnswer.length === 1 && ['A', 'B', 'C', 'D'].includes(submittedAnswer.toUpperCase())) {
                    const optionIndex = submittedAnswer.charCodeAt(0) - 65; // Convert A=0, B=1, C=2, D=3
                    if (optionIndex >= 0 && optionIndex < question.options.length) {
                      // Use index as key since questions don't have proper IDs
                      selectedAnswers[index] = question.options[optionIndex];
                    }
                  } else {
                    // It's full text answer (old format) - use it directly
                    selectedAnswers[index] = submittedAnswer;
                  }
                }
              });
            } catch (error) {
              console.error('Error parsing quiz questions/answers:', error);
              // Fallback to default values
              totalQuestions = 10;
            }
            
            // Convert backend format to frontend format
            const convertedQuiz: CompletedQuiz = {
              id: foundQuiz.quiz_id.toString(),
              title: foundQuiz.quiz_title,
              description: `${foundQuiz.course_name} - ${foundQuiz.teacher_name}`,
              completedDate: foundQuiz.submitted_at,
              duration: foundQuiz.duration_minutes,
              quizCode: foundQuiz.quiz_id.toString(),
              courseId: foundQuiz.quiz_id.toString(),
              courseName: foundQuiz.course_name,
              source: 'backend',
              score: Math.round(parseFloat(foundQuiz.score)), // Convert to integer
              totalQuestions: Number(totalQuestions) || 0,
              questions: Array.isArray(questions) ? questions : [],
              selectedAnswers: selectedAnswers || {}
            };
            
            setQuiz(convertedQuiz);
            
            // Fetch video suggestions after quiz is loaded
            if (quizId) {
              console.log('🔍 QuizResultsPage: calling fetchVideoSuggestions with quizId:', quizId);
              fetchVideoSuggestions(quizId);
            }
            return true;
          }
        }
      } catch (error) {
        console.error('Error fetching quiz from backend:', error);
      }
      return false;
    };

    // Try backend first, then fallback to localStorage
    fetchQuizFromBackend().then((foundInBackend) => {
      if (!foundInBackend) {
        // Fallback to localStorage
        const completedQuizzes = JSON.parse(localStorage.getItem('completedQuizzes') || '[]');
        console.log('🔍 QuizResultsPage: completedQuizzes from localStorage:', completedQuizzes);
        console.log('🔍 QuizResultsPage: looking for quizId:', quizId);
        
        const foundQuiz = completedQuizzes.find((q: CompletedQuiz) => q.id === quizId);
        console.log('🔍 QuizResultsPage: foundQuiz from localStorage:', foundQuiz);

        if (foundQuiz) {
          setQuiz(foundQuiz);
          // Fetch video suggestions after quiz is loaded
          if (quizId) {
            console.log('🔍 QuizResultsPage: calling fetchVideoSuggestions with quizId:', quizId);
            fetchVideoSuggestions(quizId);
          }
        } else {
          setNotFound(true);
        }
      }
      setLoading(false);
    });
  }, [quizId, navigate]);

  // Function to fetch YouTube video suggestions
  const fetchVideoSuggestions = async (quizId: string) => {
    console.log('🔍 fetchVideoSuggestions: Function called with quizId:', quizId);
    
    try {
      setLoadingVideos(true);
      setVideoError(null);
      
      // Get token from localStorage
      const token = localStorage.getItem('authToken');
      const user = localStorage.getItem('user');
      console.log('🔍 fetchVideoSuggestions: Token exists:', !!token);
      console.log('🔍 fetchVideoSuggestions: User exists:', !!user);
      
      // Check if token exists
      if (!token) {
        console.log('❌ fetchVideoSuggestions: No token found');
        setVideoError('Authentication required. Please login again.');
        return;
      }
      
      // Validate token format
      if (typeof token !== 'string' || token.trim() === '') {
        console.log('❌ fetchVideoSuggestions: Invalid token format');
        setVideoError('Invalid authentication token. Please login again.');
        return;
      }
      
      const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/$/, '');
      // Build context from stored quiz data to improve relevance
      const completedQuizzes = JSON.parse(localStorage.getItem('completedQuizzes') || '[]');
      const currentQuiz = completedQuizzes.find((q: any) => q.id === quizId);
      const contextPieces: string[] = [];
      
      if (currentQuiz?.title) contextPieces.push(currentQuiz.title);
      
      // Add PDF content if available
      if (currentQuiz?.pdfContent) {
        contextPieces.push(currentQuiz.pdfContent);
      } else {
        // Try to get PDF content from generated quizzes
        try {
          const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
          const foundQuiz = generatedQuizzes.find((q: any) => q.id === currentQuiz?.id || q.title === currentQuiz?.title);
          if (foundQuiz?.pdfContent) {
            contextPieces.push(foundQuiz.pdfContent);
          }
        } catch (_) {}
      }
      
      if (Array.isArray(currentQuiz?.questions)) {
        try {
          const qs = currentQuiz.questions.map((q: any) => q.question).join(' ');
          contextPieces.push(qs);
        } catch (_) {}
      }
      const context = encodeURIComponent(contextPieces.join(' ').slice(0, 1000)); // Increased limit for more context
      const videosUrl = `${apiBase}/api/quiz/${quizId}/video-suggestions${context ? `?context=${context}` : ''}`;
      console.log('🔍 QuizResultsPage: Making API call to:', videosUrl);
      const response = await axios.get(videosUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('✅ QuizResultsPage: API response received:', response.data);
      setVideoSuggestions(response.data);
    } catch (error: any) {
      if (error.response) {
        // Server responded with error status
        
        if (error.response.status === 401) {
          if (error.response.data?.error?.includes('token')) {
            setVideoError('Authentication token is invalid. Please login again.');
          } else {
            setVideoError('Authentication required. Please login again.');
          }
        } else if (error.response.status === 403) {
          setVideoError('Access denied. You do not have permission to view this content.');
        } else if (error.response.status === 404) {
          setVideoError('Quiz not found. The quiz may have been deleted.');
        } else {
          setVideoError(error.response.data?.error || 'Failed to fetch video suggestions');
        }
      } else if (error.request) {
        // Request was made but no response received
        setVideoError('Network error. Please check your internet connection.');
      } else {
        // Something else happened
        setVideoError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoadingVideos(false);
    }
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
            <p className="text-gray-600">Loading quiz results...</p>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }

  if (notFound || !quiz) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        
        <div className="flex-grow flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <i className="ri-error-warning-line text-3xl text-red-600"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Quiz Not Found</h2>
              <p className="text-gray-600">
                The quiz results you're looking for could not be found.
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

  const percentage = Math.round((quiz.score / quiz.totalQuestions) * 100);
  const isPassed = percentage >= 60;
  const correctAnswers = Math.round(quiz.score); // Convert score to integer

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow py-8 px-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6 overflow-hidden">
          {/* Header */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center h-24 w-24 rounded-full ${
              isPassed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            } text-4xl mb-4`}>
              <i className={`ri-${isPassed ? 'check' : 'close'}-line`}></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Quiz Results</h1>
            <p className="text-gray-600 mt-2">
              {quiz.title}
            </p>
          </div>
          
          {/* Score Summary */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-medium text-gray-800">Your Score</h2>
              <span className={`text-2xl font-bold ${
                isPassed ? 'text-green-600' : 'text-red-600'
              }`}>
                {correctAnswers}/{quiz.totalQuestions} ({percentage}%)
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div 
                className={`h-4 rounded-full ${
                  isPassed ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            
            <p className={`text-right font-medium ${
              isPassed ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPassed ? 'Passed!' : 'Failed'}
            </p>
          </div>
          
          {/* Quiz Details */}
          <div className="mb-8 bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h2 className="text-lg font-medium text-blue-800 mb-2">Quiz Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-blue-700">
              <div className="flex items-center">
                <i className="ri-calendar-line mr-2"></i>
                <span>Completed: {new Date(quiz.completedDate).toLocaleDateString()}</span>
              </div>
              {quiz.duration && (
                <div className="flex items-center">
                  <i className="ri-time-line mr-2"></i>
                  <span>Duration: {quiz.duration} minutes</span>
                </div>
              )}
              <div className="flex items-center">
                <i className="ri-key-line mr-2"></i>
                <span>Quiz Code: {quiz.quizCode}</span>
              </div>
            </div>
          </div>
          
                     {/* Question Results */}
           <div className="space-y-6">
             <h2 className="text-xl font-medium text-gray-800 mb-4">Question Results</h2>
             
             {quiz.questions?.map((question, index) => {
               // Ensure question object shape
               const q: any = question || {};
               const options: string[] = Array.isArray(q.options) ? q.options : [];
               const selectedAnswer = (quiz.selectedAnswers || {})[index];
               
               // Convert correct answer letter → text when possible
               const correctAnswerLetter = (q as any).answer || q.correctAnswer;
               let correctAnswerText: string | undefined = correctAnswerLetter;
               if (correctAnswerLetter && options.length > 0 && typeof correctAnswerLetter === 'string' && correctAnswerLetter.length === 1) {
                 const optionIndex = correctAnswerLetter.charCodeAt(0) - 65;
                 if (optionIndex >= 0 && optionIndex < options.length) {
                   correctAnswerText = options[optionIndex];
                 }
               }
               const isCorrect = (selectedAnswer || '').trim() === (correctAnswerText || '').trim();
               
               return (
                 <div 
                   key={index}
                   className={`border rounded-lg p-4 break-words ${
                     isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                   }`}
                 >
                   <h3 className="font-medium text-gray-800 mb-2 break-words">
                     {index + 1}. {q.question || 'Question'}
                   </h3>
                   
                   {options.length > 0 && (
                     <ul className="space-y-2 mb-3">
                       {options.map((option) => (
                         <li
                           key={option}
                           className={`px-3 py-2 rounded break-words ${
                             option?.trim() === (correctAnswerText || '').trim()
                               ? 'bg-green-200 text-green-800'
                               : option === selectedAnswer && option?.trim() !== (correctAnswerText || '').trim()
                                 ? 'bg-red-200 text-red-800'
                                 : 'bg-gray-100 text-gray-800'
                           }`}
                         >
                           <span className="break-words">{option}</span>
                           {option?.trim() === (correctAnswerText || '').trim() && (
                             <span className="float-right"><i className="ri-check-line"></i></span>
                           )}
                           {option === selectedAnswer && option?.trim() !== (correctAnswerText || '').trim() && (
                             <span className="float-right"><i className="ri-close-line"></i></span>
                           )}
                         </li>
                       ))}
                     </ul>
                   )}
                   
                   <div className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                     {isCorrect ? 'Correct' : `Incorrect - Your answer: ${selectedAnswer || 'Not answered'}`}
                   </div>
                 </div>
               );
             })}
           </div>
           
           {/* YouTube Video Suggestions */}
           <div className="mt-12 border-t pt-8">
             <h2 className="text-xl font-medium text-gray-800 mb-6 flex items-center">
               <i className="ri-youtube-line text-red-600 mr-2 text-2xl"></i>
               Recommended Engineering & Technology Videos
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
                 <button 
                   onClick={() => quizId && fetchVideoSuggestions(quizId)}
                   className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                 >
                   Try Again
                 </button>
               </div>
             ) : videoSuggestions && videoSuggestions.videos && videoSuggestions.videos.length > 0 && !videoSuggestions.fallback ? (
               <div>
                 {videoSuggestions.topics.length > 0 && (
                   <p className="text-gray-600 mb-4">
                     Based on topics: <span className="font-medium text-primary">{videoSuggestions.topics.map(topic => {
                       // Convert topic names to proper display format
                       const topicDisplayNames: { [key: string]: string } = {
                         'big_data': 'Big Data & Analytics',
                         'computer_science': 'Computer Science & Programming',
                         'web_development': 'Web Development',
                         'artificial_intelligence': 'Artificial Intelligence & ML',
                         'data_science': 'Data Science & Analytics',
                         'cybersecurity': 'Cybersecurity',
                         'electrical_engineering': 'Electrical Engineering',
                         'mechanical_engineering': 'Mechanical Engineering',
                         'civil_engineering': 'Civil Engineering',
                         'chemical_engineering': 'Chemical Engineering',
                         'mathematics': 'Mathematics',
                         'physics': 'Physics',
                         'robotics': 'Robotics & Automation',
                         'cloud_computing': 'Cloud Computing',
                         'mobile_development': 'Mobile Development'
                       };
                       return topicDisplayNames[topic] || topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                     }).join(', ')}</span>
                   </p>
                 )}
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {videoSuggestions.videos.map((video) => (
                     <div key={video.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                       <div className="relative">
                         <img 
                           src={video.thumbnail} 
                           alt={video.title}
                           className="w-full h-32 object-cover"
                         />
                         <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                           <i className="ri-play-fill mr-1"></i>
                           YouTube
                         </div>
                       </div>
                       
                       <div className="p-4">
                                                   {video.topic && (
                            <div className="mb-2">
                              <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                                video.topic.includes('web_development') ? 'bg-blue-100 text-blue-800' :
                                video.topic.includes('computer_science') ? 'bg-green-100 text-green-800' :
                                video.topic.includes('artificial_intelligence') ? 'bg-purple-100 text-purple-800' :
                                video.topic.includes('data_science') ? 'bg-orange-100 text-orange-800' :
                                video.topic.includes('cybersecurity') ? 'bg-red-100 text-red-800' :
                                video.topic.includes('mobile_development') ? 'bg-indigo-100 text-indigo-800' :
                                video.topic.includes('cloud_computing') ? 'bg-teal-100 text-teal-800' :
                                video.topic.includes('robotics') ? 'bg-pink-100 text-pink-800' :
                                video.topic.includes('electrical_engineering') ? 'bg-yellow-100 text-yellow-800' :
                                video.topic.includes('mechanical_engineering') ? 'bg-gray-100 text-gray-800' :
                                video.topic.includes('civil_engineering') ? 'bg-brown-100 text-brown-800' :
                                video.topic.includes('chemical_engineering') ? 'bg-cyan-100 text-cyan-800' :
                                video.topic.includes('mathematics') ? 'bg-lime-100 text-lime-800' :
                                video.topic.includes('physics') ? 'bg-amber-100 text-amber-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {video.topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            </div>
                          )}
                         
                         <h3 className="font-medium text-gray-800 mb-2 line-clamp-2">
                           {video.title}
                         </h3>
                         
                         <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                           {video.description}
                         </p>
                         
                         <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                           <span>{video.channelTitle}</span>
                           <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                         </div>
                         
                         <a
                           href={video.url}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                         >
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
             ) : (
               <div className="text-center py-8 text-gray-500">
                 <i className="ri-video-line text-4xl mb-3 text-gray-300"></i>
                 <p>No video suggestions available at the moment.</p>
                 <p className="text-sm mt-2">This might be due to API configuration or no relevant videos found.</p>
                 
                 {/* Debug Information */}
                 <div className="mt-4 p-4 bg-gray-100 rounded-lg text-left">
                   <h4 className="font-medium text-gray-800 mb-2">Debug Information:</h4>
                   <p className="text-xs text-gray-600 mb-1">
                     <strong>videoSuggestions:</strong> {videoSuggestions ? 'Present' : 'null'}
                   </p>
                   <p className="text-xs text-gray-600 mb-1">
                     <strong>videoSuggestions.videos:</strong> {videoSuggestions?.videos ? 'Present' : 'null'}
                   </p>
                   <p className="text-xs text-gray-600 mb-1">
                     <strong>videos.length:</strong> {videoSuggestions?.videos?.length || 0}
                   </p>
                   <p className="text-xs text-gray-600 mb-1">
                     <strong>videoError:</strong> {videoError || 'null'}
                   </p>
                   <p className="text-xs text-gray-600 mb-1">
                     <strong>loadingVideos:</strong> {loadingVideos ? 'true' : 'false'}
                   </p>
                   {videoSuggestions && (
                     <details className="mt-2">
                       <summary className="text-xs text-blue-600 cursor-pointer">View Full Response</summary>
                       <pre className="text-xs text-gray-600 mt-2 bg-white p-2 rounded overflow-auto max-h-32">
                         {JSON.stringify(videoSuggestions, null, 2)}
                       </pre>
                     </details>
                   )}
                 </div>
               </div>
             )}
           </div>
          
          {/* Navigation */}
          <div className="flex justify-center mt-8">
            <Link
              to="/student-dashboard"
              className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default QuizResultsPage; 