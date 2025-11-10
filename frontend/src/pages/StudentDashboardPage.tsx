import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface Course {
  id: number;
  title: string;
  instructor: string;
  progress: number;
  imageUrl: string;
}

interface Assignment {
  id: number;
  title: string;
  course: string;
  dueDate: string;
  completed: boolean;
}

interface ScheduledQuiz {
  id: string;
  title: string;
  description: string;
  scheduledDate?: string;
  dueDate?: string;
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
}

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

// Define the QuizCard component before the StudentDashboardPage component
const QuizCard: React.FC<{ quiz: ScheduledQuiz, onTake: (quiz: ScheduledQuiz) => void, isCompleted?: boolean }> = ({ quiz, onTake, isCompleted = false }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-gray-800">{quiz.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{quiz.description || 'No description provided'}</p>
          
          <div className="flex items-center mt-3 text-xs">
            {quiz.scheduledDate && (
              <span className="flex items-center text-gray-500 mr-3">
                <i className="ri-calendar-line mr-1"></i>
                {new Date(quiz.scheduledDate).toLocaleDateString()}
              </span>
            )}
            
            {quiz.duration && (
              <span className="flex items-center text-gray-500 mr-3">
                <i className="ri-time-line mr-1"></i>
                {quiz.duration} min
              </span>
            )}
            
            <span className="flex items-center text-blue-600 font-medium">
              <i className="ri-key-line mr-1"></i>
              {quiz.quizCode}
            </span>
            
            {quiz.source === 'pdf-content' && (
              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                PDF Generated
              </span>
            )}
            
            {isCompleted && (
              <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded">
                Already Attempted
              </span>
            )}
          </div>
        </div>
        
        {isCompleted ? (
          <Link
            to={`/quiz-results/${quiz.id}`}
            className="px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
          >
            View Results
          </Link>
        ) : (
          <button
            onClick={() => onTake(quiz)}
            className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            Take Quiz
          </button>
        )}
      </div>
    </div>
  );
};

// Define the CompletedQuizCard component
const CompletedQuizCard: React.FC<{ quiz: CompletedQuiz }> = ({ quiz }) => {
  const percentage = Math.round((quiz.score / quiz.totalQuestions) * 100);
  const isPassed = percentage >= 60; // Assuming 60% is passing score
  const correctAnswers = Math.round(quiz.score); // Convert score to integer
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-gray-800">{quiz.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{quiz.description || 'No description provided'}</p>
          
          <div className="flex items-center mt-3 text-xs">
            <span className="flex items-center text-gray-500 mr-3">
              <i className="ri-calendar-line mr-1"></i>
              {new Date(quiz.completedDate).toLocaleDateString()}
            </span>
            
            {quiz.duration && (
              <span className="flex items-center text-gray-500 mr-3">
                <i className="ri-time-line mr-1"></i>
                {quiz.duration} min
              </span>
            )}
            
            <span className="flex items-center text-blue-600 font-medium">
              <i className="ri-key-line mr-1"></i>
              {quiz.quizCode}
            </span>
            
            {quiz.source === 'pdf-content' && (
              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                PDF Generated
              </span>
            )}
          </div>
          
          <div className="flex items-center mt-2">
            <span className={`text-sm font-medium ${
              isPassed ? 'text-green-600' : 'text-red-600'
            }`}>
              Score: {correctAnswers}/{quiz.totalQuestions} ({percentage}%)
            </span>
            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
              isPassed 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {isPassed ? 'Passed' : 'Failed'}
            </span>
          </div>
        </div>
        
        <Link
          to={`/quiz-results/${quiz.id}`}
          className="px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
        >
          Show Quiz
        </Link>
      </div>
    </div>
  );
};

const StudentDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scheduledQuizzes, setScheduledQuizzes] = useState<ScheduledQuiz[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<CompletedQuiz[]>([]);
  const [completedQuizIds, setCompletedQuizIds] = useState<Set<string>>(new Set());
  const [quizCode, setQuizCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [quizCodeError, setQuizCodeError] = useState('');
  
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Fetch available quizzes from backend
    const fetchAvailableQuizzes = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/available`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (response.ok) {
          const availableQuizzes = await response.json();
          console.log('Available quizzes from backend:', availableQuizzes);
          
          // Convert backend quizzes to ScheduledQuiz format
          const backendQuizzes: ScheduledQuiz[] = availableQuizzes.map((quiz: any) => ({
            id: quiz.id.toString(),
            title: quiz.title,
            description: `Quiz by ${quiz.teacher_name} - ${quiz.course_name}`,
            scheduledDate: quiz.created_at,
            duration: quiz.duration_minutes,
            quizCode: quiz.access_code,
            source: 'backend'
          }));
          
          // Load existing student-scheduled quizzes (student-created reminders only)
          const storedQuizzes = JSON.parse(localStorage.getItem('studentScheduledQuizzes') || '[]');

          // Combine backend + existing, avoiding duplicates by quizCode
          const allQuizzes: ScheduledQuiz[] = [...storedQuizzes];
          const pushUnique = (arr: ScheduledQuiz[]) => {
            arr.forEach(item => {
              const code = (item.quizCode || '').toUpperCase();
              if (!code) return; // skip invalid entries
              if (!allQuizzes.find(q => (q.quizCode || '').toUpperCase() === code)) {
                allQuizzes.push(item);
              }
            });
          };
          pushUnique(backendQuizzes);
          // Note: Do not merge locally-generated teacher quizzes into student view.
          
          // Load completed quizzes from backend API
          const fetchCompletedQuizzes = async () => {
            try {
              const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/student/completed`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
              });
              
              if (response.ok) {
                const backendCompletedQuizzes = await response.json();
                console.log('Completed quizzes from backend:', backendCompletedQuizzes);
                
                // Convert backend format to frontend format
                const convertedCompletedQuizzes: CompletedQuiz[] = backendCompletedQuizzes.map((quiz: any) => ({
                  id: quiz.quiz_id.toString(),
                  title: quiz.quiz_title,
                  description: `${quiz.course_name} - ${quiz.teacher_name}`,
                  completedDate: quiz.submitted_at,
                  duration: quiz.duration_minutes,
                  quizCode: quiz.quiz_id.toString(), // Using quiz ID as code
                  courseId: quiz.quiz_id.toString(),
                  courseName: quiz.course_name,
                  source: 'backend',
                  score: Math.round(parseFloat(quiz.score)),
                  totalQuestions: 10, // Default to 10 questions to avoid NaN% calculation
                  selectedAnswers: {} // Not available in backend response
                }));
                
                setCompletedQuizzes(convertedCompletedQuizzes);
                
                // Create a set of completed quiz IDs for quick lookup
                const completedIds = new Set(convertedCompletedQuizzes.map(quiz => quiz.id));
                setCompletedQuizIds(completedIds);
                
                // Filter out completed quizzes from scheduled quizzes
                const completedQuizIds = convertedCompletedQuizzes.map((q: CompletedQuiz) => q.id);
                const activeQuizzes = allQuizzes.filter(quiz => !completedQuizIds.includes(quiz.id));
                setScheduledQuizzes(activeQuizzes);
              } else {
                console.error('Failed to fetch completed quizzes from backend');
                // Fallback to localStorage
                const storedCompletedQuizzes = JSON.parse(localStorage.getItem('completedQuizzes') || '[]');
                setCompletedQuizzes(storedCompletedQuizzes);
                
                const completedQuizIds = storedCompletedQuizzes.map((q: CompletedQuiz) => q.id);
                const activeQuizzes = allQuizzes.filter(quiz => !completedQuizIds.includes(quiz.id));
                setScheduledQuizzes(activeQuizzes);
              }
            } catch (error) {
              console.error('Error fetching completed quizzes:', error);
              // Fallback to localStorage
              const storedCompletedQuizzes = JSON.parse(localStorage.getItem('completedQuizzes') || '[]');
              setCompletedQuizzes(storedCompletedQuizzes);
              
              const completedQuizIds = storedCompletedQuizzes.map((q: CompletedQuiz) => q.id);
              const activeQuizzes = allQuizzes.filter(quiz => !completedQuizIds.includes(quiz.id));
              setScheduledQuizzes(activeQuizzes);
            }
          };
          
          // Fetch completed quizzes from backend
          fetchCompletedQuizzes();
        }
      } catch (error) {
        console.error('Error fetching available quizzes:', error);
      }
    };
    
    // Simulate API call to get dashboard data
    setTimeout(() => {
      setCourses([
        {
          id: 1,
          title: 'Introduction to Computer Science',
          instructor: 'Dr. Smith',
          progress: 65,
          imageUrl: 'https://public.readdy.ai/ai/img_res/c2b6a1c2a0a2f01b3cebf7bc4b28df92.jpg'
        },
        {
          id: 2,
          title: 'Advanced Mathematics',
          instructor: 'Prof. Johnson',
          progress: 42,
          imageUrl: 'https://public.readdy.ai/ai/img_res/1e8954d5adaed647d599a83d143e7fe8.jpg'
        },
        {
          id: 3,
          title: 'Biology 101',
          instructor: 'Dr. Williams',
          progress: 78,
          imageUrl: 'https://public.readdy.ai/ai/img_res/82c3d797823dc44d0fcf84c4b9a1c8da.jpg'
        }
      ]);
      
      setAssignments([
        {
          id: 1,
          title: 'Algorithm Analysis Report',
          course: 'Computer Science',
          dueDate: '2023-06-15',
          completed: false
        },
        {
          id: 2,
          title: 'Calculus Problem Set',
          course: 'Mathematics',
          dueDate: '2023-06-12',
          completed: true
        },
        {
          id: 3,
          title: 'Lab Report: Cell Division',
          course: 'Biology',
          dueDate: '2023-06-10',
          completed: false
        }
      ]);
      
      // Fetch available quizzes from backend
      fetchAvailableQuizzes();
      
      setLoading(false);
    }, 1500);
  }, [navigate]);

  const handleTakeScheduledQuiz = async (quiz: ScheduledQuiz) => {
    try {
      // Always attempt to fetch the full quiz by access code to ensure we have real questions
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/access/${quiz.quizCode}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      if (resp.ok) {
        const quizData = await resp.json();
        let questionsParsed: any[] = [];
        try {
          questionsParsed = JSON.parse(quizData.questions || '[]');
        } catch (_) {
          // Best-effort fallback: split on blank lines into pseudo-questions
          const raw = String(quizData.questions || '');
          const chunks = raw.split(/\r?\n\r?\n/).filter((s: string) => s.trim());
          questionsParsed = chunks.map((text: string, idx: number) => ({
            id: idx + 1,
            question: text.substring(0, 200),
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A'
          }));
        }

        const quizForStorage = {
          id: String(quizData.id),
          title: quizData.title,
          description: `Quiz by code ${quiz.quizCode}`,
          questions: questionsParsed,
          duration: quizData.duration_minutes || quiz.duration || 20,
          code: quiz.quizCode,
          source: 'backend',
          createdAt: new Date().toISOString()
        };

        const existing = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
        // Replace any existing entry for same id/code
        const filtered = existing.filter((q: any) => q.id !== quizForStorage.id && q.code !== quizForStorage.code);
        localStorage.setItem('generatedQuizzes', JSON.stringify([...filtered, quizForStorage]));

        navigate(`/quiz/${quizData.id}?start=true`);
        return;
      }

      // Fallback: navigate with what we have (may show sample if questions missing)
      navigate(`/quiz/${quiz.id}?start=true`);
    } catch (e) {
      console.error('Error taking scheduled quiz:', e);
      navigate(`/quiz/${quiz.id}`);
    }
  };
  
  const handleSubmitQuizCode = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quizCode.trim()) {
      setQuizCodeError('Please enter a quiz code');
      return;
    }
    
    // First try to find the quiz in the backend
    const fetchQuizFromBackend = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/access/${quizCode.trim().toUpperCase()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (response.ok) {
          const quizData = await response.json();
          
          // Save quiz data to localStorage for the quiz page
          const quizForStorage = {
            id: quizData.id.toString(),
            title: quizData.title,
            description: `Quiz accessed via code: ${quizCode.trim().toUpperCase()}`,
            questions: JSON.parse(quizData.questions || '[]'),
            duration: quizData.duration_minutes || 20,
            code: quizCode.trim().toUpperCase(),
            source: 'backend',
            createdAt: new Date().toISOString()
          };
          
          // Save to generatedQuizzes for quiz page access
          const existingQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
          localStorage.setItem('generatedQuizzes', JSON.stringify([...existingQuizzes, quizForStorage]));
          
          // Clear the form and close modal
          setQuizCode('');
          setQuizCodeError('');
          setShowCodeModal(false);
          
          // Navigate directly to the quiz page
          navigate(`/quiz/${quizData.id}`);
          
          return true;
        }
      } catch (error) {
        console.error('Error fetching quiz from backend:', error);
      }
      return false;
    };
    
    // Try backend first, then fallback to localStorage
    fetchQuizFromBackend().then((foundInBackend) => {
      if (!foundInBackend) {
        // Fallback to localStorage check
        const storedCodes = JSON.parse(localStorage.getItem('quizCodes') || '[]');
        console.log('Stored codes:', storedCodes);
        console.log('Current code:', quizCode.trim().toUpperCase());
        
        if (storedCodes.includes(quizCode.trim().toUpperCase())) {
          // Find the quiz with this code in generatedQuizzes
          const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
          const foundQuiz = generatedQuizzes.find((q: any) => q.code === quizCode.trim().toUpperCase());
          console.log('Found quiz:', foundQuiz);
          
          if (foundQuiz) {
            // Navigate directly to the quiz page
            setQuizCode('');
            setQuizCodeError('');
            setShowCodeModal(false);
            
            navigate(`/quiz/${foundQuiz.id}`);
          } else {
            setQuizCodeError('Unable to find quiz with this code. Please try again.');
          }
        } else {
          // DEMO ONLY: For demo purposes, allow DS5432 to work even if not in localStorage
          if (quizCode.trim().toUpperCase() === 'DS5432' || quizCode.trim().toUpperCase().startsWith('DS')) {
            const demoQuizId = 'demo-' + new Date().getTime();
            
            // Save demo quiz to generatedQuizzes for quiz page access
            const demoQuizForStorage = {
              id: demoQuizId,
              title: 'Demo Quiz: Data Structures',
              description: 'This is a demo quiz for testing purposes.',
              questions: Array(5).fill({
                id: 1,
                question: 'Sample question about data structures',
                options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
                correctAnswer: 'Option 1'
              }),
              duration: 15,
              code: quizCode.trim().toUpperCase(),
              source: 'demo',
              createdAt: new Date().toISOString()
            };
            
            // Save to generatedQuizzes for quiz page access
            const existingQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
            localStorage.setItem('generatedQuizzes', JSON.stringify([...existingQuizzes, demoQuizForStorage]));
            
            // Clear the form and close modal
            setQuizCode('');
            setQuizCodeError('');
            setShowCodeModal(false);
            
            // Navigate directly to the quiz page
            navigate(`/quiz/${demoQuizId}`);
          } else {
            setQuizCodeError('Invalid quiz code. Please check and try again.');
          }
        }
      }
    });
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
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
        
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">

          
          {/* Welcome Section */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h1 className="text-2xl font-bold text-gray-800">Welcome back, Student!</h1>
            <p className="text-gray-600 mt-2">Track your progress and upcoming assignments.</p>
            
            {/* Stats Overview */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-primary/5 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="bg-primary/10 rounded-full p-3 mr-4">
                    <i className="ri-book-open-line text-xl text-primary"></i>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Enrolled Courses</p>
                    <p className="text-2xl font-semibold text-gray-800">{courses.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-accent/5 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="bg-accent/10 rounded-full p-3 mr-4">
                    <i className="ri-task-line text-xl text-accent"></i>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Pending Assignments</p>
                    <p className="text-2xl font-semibold text-gray-800">
                      {assignments.filter(a => !a.completed).length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-warning/5 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="bg-warning/10 rounded-full p-3 mr-4">
                    <i className="ri-calendar-event-line text-xl text-warning"></i>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Upcoming Quizzes</p>
                    <p className="text-2xl font-semibold text-gray-800">{scheduledQuizzes.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-success/5 rounded-lg p-4 cursor-pointer hover:bg-success/10 transition-all" onClick={() => setShowCodeModal(true)}>
                <div className="flex items-center">
                  <div className="bg-success/10 rounded-full p-3 mr-4">
                    <i className="ri-questionnaire-line text-xl text-success"></i>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Enter Quiz Code</p>
                    <p className="text-sm font-medium text-success flex items-center">
                      Access Quiz <i className="ri-arrow-right-line ml-1"></i>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Your Courses Section */}
            <div className="lg:col-span-2">
              <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Your Courses</h2>
                  <Link to="#" className="text-primary hover:text-secondary text-sm font-medium">
                    View All Courses
                  </Link>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {courses.map(course => (
                    <div key={course.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div 
                        className="h-32 bg-center bg-cover" 
                        style={{ backgroundImage: `url(${course.imageUrl})` }}
                      >
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-gray-800 mb-1">{course.title}</h3>
                        <p className="text-sm text-gray-600 mb-3">Instructor: {course.instructor}</p>
                        
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{course.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`rounded-full h-2 ${
                                course.progress >= 70 ? 'bg-green-500' : 
                                course.progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`} 
                              style={{ width: `${course.progress}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <Link 
                            to={`/course/${course.id}`}
                            className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-md hover:bg-primary/20 transition-colors"
                          >
                            Go to Course
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Upcoming Quizzes */}
              <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Upcoming Quizzes</h2>
                  <Link to="#" className="text-primary hover:text-secondary text-sm font-medium">
                    View All Quizzes
                  </Link>
                </div>
                
                {scheduledQuizzes.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm p-6 text-center border-2 border-dashed border-gray-200">
                    <i className="ri-calendar-line text-4xl text-gray-300 mb-2"></i>
                    <p className="text-gray-500">No upcoming quizzes.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scheduledQuizzes.map(quiz => (
                      <QuizCard
                        key={(quiz.quizCode || `${quiz.id}-${quiz.scheduledDate || ''}`).toString()}
                        quiz={quiz}
                        onTake={handleTakeScheduledQuiz}
                        isCompleted={completedQuizIds.has(quiz.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              {/* Completed Quizzes */}
              <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Completed Quizzes</h2>
                  <Link to="#" className="text-primary hover:text-secondary text-sm font-medium">
                    View All Results
                  </Link>
                </div>
                
                {completedQuizzes.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm p-6 text-center border-2 border-dashed border-gray-200">
                    <i className="ri-check-double-line text-4xl text-gray-300 mb-2"></i>
                    <p className="text-gray-500">No completed quizzes yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Complete a quiz to see your results here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {completedQuizzes.map(quiz => (
                      <CompletedQuizCard key={`${quiz.id}-${quiz.completedDate}`} quiz={quiz} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Sidebar - Assignments */}
            <div>
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Upcoming Assignments</h2>
                
                {assignments.filter(a => !a.completed).length === 0 ? (
                  <div className="text-center py-8">
                    <i className="ri-task-line text-4xl text-gray-300 mb-2"></i>
                    <p className="text-gray-500">No pending assignments</p>
                    <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments
                      .filter(a => !a.completed)
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .map(assignment => (
                        <div key={assignment.id} className="border-b border-gray-100 pb-4 last:border-0">
                          <div className="flex justify-between">
                            <h3 className="font-medium text-gray-800">{assignment.title}</h3>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">Course: {assignment.course}</p>
                          
                          <div className="flex justify-between items-center mt-3">
                            <p className={`text-xs ${
                              new Date(assignment.dueDate) < new Date() 
                                ? 'text-red-500 font-medium' 
                                : 'text-gray-500'
                            }`}>
                              Due: {new Date(assignment.dueDate).toLocaleDateString()}
                            </p>
                            <Link 
                              to={`/assignment/${assignment.id}`}
                              className="text-sm text-primary hover:text-secondary font-medium"
                            >
                              View Details
                            </Link>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
                
                <div className="mt-8 border-t border-gray-100 pt-4">
                  <h3 className="font-medium text-gray-700 mb-3">Completed Assignments</h3>
                  
                  {assignments.filter(a => a.completed).length === 0 ? (
                    <p className="text-sm text-gray-500">No completed assignments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {assignments
                        .filter(a => a.completed)
                        .map(assignment => (
                          <div key={assignment.id} className="flex justify-between items-center">
                            <div className="flex items-center">
                              <i className="ri-checkbox-circle-fill text-green-500 mr-2"></i>
                              <span className="text-sm text-gray-700">{assignment.title}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {assignment.course}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Quiz Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Enter Quiz Code</h3>
              <button 
                onClick={() => {
                  setShowCodeModal(false);
                  setQuizCode('');
                  setCodeError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">
              Enter the 6-character code provided by your teacher to access the quiz.
            </p>
            
            {quizCodeError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <i className="ri-error-warning-fill text-red-500"></i>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{quizCodeError}</p>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmitQuizCode}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quiz Code
                </label>
                <input
                  type="text"
                  value={quizCode}
                  onChange={(e) => {
                    // Convert to uppercase, remove any non-alphanumeric characters, and limit to 6 characters
                    const sanitizedInput = e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 6);
                    setQuizCode(sanitizedInput);
                    setCodeError(null);
                  }}
                  autoFocus
                  placeholder="XXXXXX"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-center font-mono text-xl tracking-wider uppercase"
                  style={{ letterSpacing: '0.5em' }}
                />
                <p className="mt-2 text-xs text-gray-500 text-center">
                  For demo purposes, try entering <span className="font-mono font-medium bg-gray-100 px-1 py-0.5 rounded">DS5432</span> or any code that starts with DS
                </p>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCodeModal(false);
                    setQuizCode('');
                    setCodeError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  Access Quiz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
};

export default StudentDashboardPage; 