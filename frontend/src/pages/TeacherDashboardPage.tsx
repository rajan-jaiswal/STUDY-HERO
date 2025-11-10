import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FileUploader from '../components/FileUploader';
import ManualQuizBuilder from '../components/ManualQuizBuilder';
import RecommendationsBuilder from '../components/RecommendationsBuilder';
import QuizManager from '../components/QuizManager';

interface Course {
  id: number;
  title: string;
  students: number;
  imageUrl: string;
  lastUpdated: string;
}

interface Student {
  id: number;
  name: string;
  email: string;
  progress: number;
  avatar: string;
}

interface Assignment {
  id: number;
  title: string;
  dueDate: string;
  course: string;
  submissions: number;
  totalStudents: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
  isActive?: boolean;
  scheduledDate?: string;
  duration?: number;
  preventTabSwitch?: boolean;
  randomizeQuestions?: boolean;
  pdfContent?: string; // PDF content for video suggestions
  showOneQuestionAtATime?: boolean;
  requireWebcam?: boolean;
  passingScore?: number;
  quizCode?: string;
  code?: string;
}

interface StoredQuiz {
  id: string;
  title: string;
  description: string;
  questions: {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
  isActive?: boolean;
  scheduledDate?: string;
  duration?: number;
  preventTabSwitch?: boolean;
  randomizeQuestions?: boolean;
  showOneQuestionAtATime?: boolean;
  requireWebcam?: boolean;
  passingScore?: number;
  quizCode?: string;
  code: string;
  settings: {
    timeLimit: number;
    preventTabSwitch: boolean;
    randomizeQuestions: boolean;
    showOneQuestionAtATime: boolean;
    requireWebcam: boolean;
  };
  createdAt: string;
  source: string;
}

interface QuizManagerProps {
  quizzes: StoredQuiz[];
  onDelete: (quizId: string) => void;
}

const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'generate-quiz' | 'manage-quizzes' | 'recommendations'>('dashboard');
  const [generateMode, setGenerateMode] = useState<'pdf' | 'manual'>('pdf');
  const [pdfContent, setPdfContent] = useState<string>('');
  const [createdQuizzes, setCreatedQuizzes] = useState<StoredQuiz[]>([]);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [activeView, setActiveView] = useState<'quizCreated' | 'quizPreview'>('quizCreated');
  const [generatedQuiz, setGeneratedQuiz] = useState<StoredQuiz | null>(null);
  
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Fetch teacher's quizzes from backend
    const fetchTeacherQuizzes = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/teacher-quizzes`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (response.ok) {
          const teacherQuizzes = await response.json();
          console.log('Teacher quizzes from backend:', teacherQuizzes);
          
          // Convert backend quizzes to StoredQuiz format
          const backendQuizzes: StoredQuiz[] = teacherQuizzes.map((quiz: any) => ({
            id: quiz.id.toString(),
            title: quiz.title,
            description: `Quiz for ${quiz.course_name}`,
            questions: [], // Questions are stored separately in backend
            code: quiz.access_code,
            quizCode: quiz.access_code,
            duration: quiz.duration_minutes,
            createdAt: quiz.created_at,
            source: quiz.is_auto_generated ? 'pdf-content' : 'manual',
            settings: {
              timeLimit: quiz.duration_minutes,
              preventTabSwitch: true,
              randomizeQuestions: true,
              showOneQuestionAtATime: true,
              requireWebcam: false
            },
            isPublished: !!quiz.is_published
          }));
          
          // Load existing quizzes from localStorage
          const storedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
          
          // Combine backend quizzes with stored quizzes, avoiding duplicates
          const allQuizzes = [...storedQuizzes];
          backendQuizzes.forEach(backendQuiz => {
            const code = (backendQuiz.code || '').toUpperCase();
            if (!code) return;
            if (!allQuizzes.find((q: any) => (q.code || '').toUpperCase() === code)) {
              allQuizzes.push(backendQuiz);
            }
          });
          
          setCreatedQuizzes(allQuizzes);
        }
      } catch (error) {
        console.error('Error fetching teacher quizzes:', error);
      }
    };
    
    // Simulate API call to get dashboard data
    setTimeout(() => {
      setCourses([
        {
          id: 1,
          title: 'Introduction to Computer Science',
          students: 45,
          imageUrl: 'https://public.readdy.ai/ai/img_res/c2b6a1c2a0a2f01b3cebf7bc4b28df92.jpg',
          lastUpdated: '2023-06-02'
        },
        {
          id: 2,
          title: 'Advanced Mathematics',
          students: 28,
          imageUrl: 'https://public.readdy.ai/ai/img_res/1e8954d5adaed647d599a83d143e7fe8.jpg',
          lastUpdated: '2023-06-05'
        },
        {
          id: 3,
          title: 'Biology 101',
          students: 36,
          imageUrl: 'https://public.readdy.ai/ai/img_res/82c3d797823dc44d0fcf84c4b9a1c8da.jpg',
          lastUpdated: '2023-06-01'
        }
      ]);
      
      setStudents([
        {
          id: 1,
          name: 'John Doe',
          email: 'john.doe@example.com',
          progress: 75,
          avatar: 'JD'
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          progress: 92,
          avatar: 'JS'
        },
        {
          id: 3,
          name: 'Robert Johnson',
          email: 'robert.johnson@example.com',
          progress: 45,
          avatar: 'RJ'
        },
        {
          id: 4,
          name: 'Sarah Williams',
          email: 'sarah.williams@example.com',
          progress: 68,
          avatar: 'SW'
        },
        {
          id: 5,
          name: 'Michael Brown',
          email: 'michael.brown@example.com',
          progress: 33,
          avatar: 'MB'
        }
      ]);
      
      setPendingAssignments([
        {
          id: 1,
          title: 'Algorithm Analysis Report',
          dueDate: '2023-06-15',
          course: 'Computer Science',
          submissions: 32,
          totalStudents: 45
        },
        {
          id: 2,
          title: 'Calculus Problem Set',
          dueDate: '2023-06-12',
          course: 'Mathematics',
          submissions: 15,
          totalStudents: 28
        },
        {
          id: 3,
          title: 'Lab Report: Cell Division',
          dueDate: '2023-06-10',
          course: 'Biology',
          submissions: 20,
          totalStudents: 36
        }
      ]);
      
      // Fetch teacher's quizzes from backend
      fetchTeacherQuizzes();
      
      setLoading(false);
    }, 1500);
  }, [navigate]);
  
  // Function to update localStorage whenever quizzes change
  const updateStoredQuizzes = (updatedQuizzes: Quiz[]) => {
    localStorage.setItem('generatedQuizzes', JSON.stringify(updatedQuizzes));
  };
  
  const handleQuizGenerated = (quiz: Quiz) => {
    // The FileUploader component now handles the quiz code display
    // This function is called after quiz generation is complete
    console.log('Quiz generated successfully:', quiz);
    
    // Store PDF content for recommendations
    if (quiz.pdfContent) {
      setPdfContent(quiz.pdfContent);
    }
    
    // Update the created quizzes list
    const quizWithSettings: StoredQuiz = {
      ...quiz,
      code: quiz.code || quiz.quizCode || '',
      settings: {
        timeLimit: quiz.duration || 20,
        preventTabSwitch: true,
        randomizeQuestions: true,
        showOneQuestionAtATime: true,
        requireWebcam: false
      },
      createdAt: new Date().toISOString(),
      source: 'pdf-content'
    };
    
    setCreatedQuizzes([...createdQuizzes, quizWithSettings]);
    setActiveTab('generate-quiz'); // Stay on the quiz tab
  };
  
  const generateQuizCode = (): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const codeLength = 6;
    let result = '';
    
    for (let i = 0; i < codeLength; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    const existingCodes = quizzes.map(quiz => quiz.quizCode);
    if (existingCodes.includes(result)) {
      return generateQuizCode();
    }
    
    return result;
  };
  
  const handleActivateQuiz = (quizId: string, settings: Partial<Quiz>) => {
    const quizCode = generateQuizCode();
    
    const updatedQuizzes = quizzes.map(quiz => 
      quiz.id === quizId 
        ? { ...quiz, ...settings, isActive: true, quizCode } 
        : quiz
    );
    
    setQuizzes(updatedQuizzes);
    updateStoredQuizzes(updatedQuizzes);
    
    console.log(`Quiz ${quizId} activated with code: ${quizCode}`);
    
    // Show a confirmation alert with the quiz code
    alert(`Quiz activated successfully! Quiz Code: ${quizCode}\n\nShare this code with your students.`);
  };
  
  const handleEditQuiz = (quizId: string) => {
    // In a real app, we would navigate to an edit page or open a modal
    alert(`Edit quiz ${quizId}`);
  };
  
  const handleDeleteQuiz = async (quizId: string) => {
    if (!window.confirm('Delete this quiz? This action cannot be undone.')) return;

    // Remove from locally created quizzes list (the one displayed in Manage Quizzes)
    const updatedCreated = createdQuizzes.filter(q => String(q.id) !== String(quizId));
    setCreatedQuizzes(updatedCreated);

    // Persist to localStorage list used across the app
    try {
      const stored = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
      const updatedStored = stored.filter((q: any) => String(q.id) !== String(quizId) && String(q.code || '') !== String((createdQuizzes.find(c=>String(c.id)===String(quizId))?.code) || ''));
      localStorage.setItem('generatedQuizzes', JSON.stringify(updatedStored));
    } catch {}

    // Best-effort backend deletion if endpoint exists
    try {
      const token = localStorage.getItem('authToken') || '';
      await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/${quizId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    } catch {}

    // Also prune from transient quizzes state (used elsewhere)
    const updatedQuizzes = quizzes.filter(quiz => String(quiz.id) !== String(quizId));
    setQuizzes(updatedQuizzes);
    updateStoredQuizzes(updatedQuizzes);

    alert('Quiz deleted.');
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Welcome back, Professor!</h1>
                <p className="text-gray-600 mt-2">Manage your courses and monitor student progress.</p>
              </div>
              <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'dashboard' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-dashboard-line mr-2"></i>
                  Dashboard
                </button>
                <button 
                  onClick={() => setActiveTab('generate-quiz')}
                  className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'generate-quiz' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-file-upload-line mr-2"></i>
                  Generate Quiz
                </button>
                <button 
                  onClick={() => setActiveTab('manage-quizzes')}
                  className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'manage-quizzes' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-file-list-3-line mr-2"></i>
                  Manage Quizzes
                </button>
                <button 
                  onClick={() => setActiveTab('recommendations')}
                  className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'recommendations' 
                      ? 'bg-primary text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-lightbulb-line mr-2"></i>
                  Recommendations
                </button>
              </div>
            </div>
            
            {activeTab === 'dashboard' && (
              <div>
                {/* Stats Overview */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-primary/10 rounded-full p-3 mr-4">
                        <i className="ri-book-open-line text-xl text-primary"></i>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Active Courses</p>
                        <p className="text-2xl font-semibold text-gray-800">{courses.length}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-accent/5 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-accent/10 rounded-full p-3 mr-4">
                        <i className="ri-user-line text-xl text-accent"></i>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Total Students</p>
                        <p className="text-2xl font-semibold text-gray-800">
                          {courses.reduce((acc, course) => acc + course.students, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-warning/5 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-warning/10 rounded-full p-3 mr-4">
                        <i className="ri-task-line text-xl text-warning"></i>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Active Assignments</p>
                        <p className="text-2xl font-semibold text-gray-800">{pendingAssignments.length}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-success/5 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="bg-success/10 rounded-full p-3 mr-4">
                        <i className="ri-file-list-3-line text-xl text-success"></i>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">Active Quizzes</p>
                        <p className="text-2xl font-semibold text-gray-800">
                          {quizzes.filter(q => q.isActive).length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {activeTab === 'dashboard' && (
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
                          <h3 className="font-bold text-gray-800 mb-2">{course.title}</h3>
                          <div className="flex justify-between text-sm text-gray-600 mb-3">
                            <span>{course.students} students</span>
                            <span>Last updated: {new Date(course.lastUpdated).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-end">
                            <Link 
                              to={`/course/${course.id}`}
                              className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-md hover:bg-primary/20 transition-colors"
                            >
                              Manage Course
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Student Progress */}
                <div className="mb-10">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Student Progress</h2>
                    <Link to="#" className="text-primary hover:text-secondary text-sm font-medium">
                      View All Students
                    </Link>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Student
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Progress
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {students.map(student => (
                            <tr key={student.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                                    {student.avatar}
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{student.name}</div>
                                    <div className="text-sm text-gray-500">{student.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                    <div 
                                      className={`h-2.5 rounded-full ${
                                        student.progress >= 70 ? 'bg-green-500' : 
                                        student.progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`} 
                                      style={{ width: `${student.progress}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-gray-600">{student.progress}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Link to={`/student/${student.id}`} className="text-primary hover:text-secondary">
                                  View Details
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Recently Generated Quizzes */}
              <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Recently Generated Quizzes</h2>
                  <button
                    onClick={() => setActiveTab('manage-quizzes')}
                    className="text-primary hover:text-secondary text-sm font-medium"
                  >
                    Manage All
                  </button>
                </div>

                <div className="bg-white rounded-xl shadow-md">
                  {createdQuizzes.length === 0 ? (
                    <div className="p-6 text-center">
                      <i className="ri-questionnaire-line text-4xl text-gray-300 mb-2"></i>
                      <p className="text-gray-500">No quizzes generated yet.</p>
                      <button
                        onClick={() => setActiveTab('generate-quiz')}
                        className="mt-3 inline-flex items-center px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary/90"
                      >
                        <i className="ri-add-line mr-1"></i>
                        Generate Quiz
                      </button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {createdQuizzes.slice(0, 5).map((q) => (
                        <li key={q.id} className="p-4 flex items-start justify-between">
                          <div className="flex-1 pr-4">
                            <h3 className="font-medium text-gray-800">{q.title}</h3>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-1">{q.description || 'No description'}</p>
                            <div className="mt-2 flex items-center space-x-2 text-xs">
                              <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">Code: {q.code}</span>
                              <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">{q.settings?.timeLimit || q.duration || 20} min</span>
                              {q.source === 'pdf-content' && (
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">PDF Generated</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/quiz-preview/${q.id}`}
                              className="px-3 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                            >
                              <i className="ri-eye-line mr-1"></i>
                              Preview & Edit
                            </Link>
                            <button
                              onClick={() => setActiveTab('manage-quizzes')}
                              className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                            >
                              Manage
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Sidebar - Assignments */}
              <div>
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Pending Assignments</h2>
                  
                  {pendingAssignments.map(assignment => (
                    <div key={assignment.id} className="border-b border-gray-100 py-4 last:border-0">
                      <div className="flex justify-between">
                        <h3 className="font-medium text-gray-800">{assignment.title}</h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Course: {assignment.course}</p>
                      
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Submissions: {assignment.submissions}/{assignment.totalStudents}</span>
                          <span>{Math.round((assignment.submissions / assignment.totalStudents) * 100)}% Complete</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 rounded-full h-2" 
                            style={{ width: `${(assignment.submissions / assignment.totalStudents) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-4">
                        <p className="text-xs text-gray-500">
                          Due: {new Date(assignment.dueDate).toLocaleDateString()}
                        </p>
                        <Link 
                          to={`/assignment/${assignment.id}/review`}
                          className="text-sm text-primary hover:text-secondary font-medium"
                        >
                          Review Submissions
                        </Link>
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-6 text-center">
                    <Link 
                      to="#"
                      className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                    >
                      <i className="ri-add-line mr-2"></i>
                      Create New Assignment
                    </Link>
                  </div>
                </div>
                
                {/* Active Quizzes Overview */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Active Quizzes</h2>
                  
                  {quizzes.filter(q => q.isActive).length === 0 ? (
                    <div className="text-center py-6">
                      <i className="ri-questionnaire-line text-4xl text-gray-300 mb-2"></i>
                      <p className="text-gray-500">No active quizzes</p>
                      <button 
                        onClick={() => setActiveTab('generate-quiz')}
                        className="mt-4 text-primary hover:text-primary/80"
                      >
                        Generate a quiz
                      </button>
                    </div>
                  ) : (
                    quizzes.filter(q => q.isActive).map(quiz => (
                      <div key={`${quiz.id}-${quiz.quizCode || ''}`} className="border-b border-gray-100 py-4 last:border-0">
                        <div className="flex justify-between">
                          <h3 className="font-medium text-gray-800">{quiz.title}</h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{quiz.description || 'No description'}</p>
                        
                        <div className="flex justify-between items-center mt-4">
                          <p className="text-xs text-gray-500">
                            Scheduled: {new Date(quiz.scheduledDate || '').toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            Duration: {quiz.duration} min
                          </p>
                        </div>
                        
                        <div className="flex justify-between mt-3">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Active
                          </span>
                          <Link 
                            to={`/quiz/${quiz.id}/results`}
                            className="text-sm text-primary hover:text-secondary font-medium"
                          >
                            View Results
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'generate-quiz' && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-xl shadow-md p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setGenerateMode('pdf')}
                    className={`px-3 py-1.5 rounded-md text-sm ${generateMode === 'pdf' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    <i className="ri-file-upload-line mr-1"></i>
                    By PDF
                  </button>
                  <button
                    onClick={() => setGenerateMode('manual')}
                    className={`px-3 py-1.5 rounded-md text-sm ${generateMode === 'manual' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    <i className="ri-edit-2-line mr-1"></i>
                    Manual
                  </button>
                </div>
                <span className="text-xs text-gray-500">Create from PDF or build questions manually</span>
              </div>

              {generateMode === 'pdf' ? (
                <FileUploader onQuizGenerated={handleQuizGenerated} />
              ) : (
                <ManualQuizBuilder onCreated={(id) => navigate(`/quiz-preview/${id}`)} />
              )}
            </div>
          )}
          
          {activeTab === 'manage-quizzes' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Your Created Quizzes</h2>
                <p className="text-sm text-gray-600 mb-4">Preview, edit, publish or unpublish your quizzes.</p>
                <QuizManager 
                  quizzes={createdQuizzes}
                  onDelete={handleDeleteQuiz}
                  onDeleteQuiz={handleDeleteQuiz}
                  onEditQuiz={handleEditQuiz}
                  onActivateQuiz={handleActivateQuiz}
                />
              </div>
            </div>
          )}
          
          {activeTab === 'recommendations' && (
            <div className="max-w-4xl mx-auto">
              <RecommendationsBuilder 
                pdfContent={pdfContent}
                onCreated={(recommendations) => {
                  console.log('Recommendations created:', recommendations);
                }}
              />
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default TeacherDashboardPage; 