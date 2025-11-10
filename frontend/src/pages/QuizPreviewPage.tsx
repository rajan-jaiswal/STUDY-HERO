import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface Question {
  id: number;
  question: string;
  options?: string[];
  answer?: string;
  type?: 'mcq' | 'code';
  language?: string;
  starterCode?: string;
  testCases?: { stdin?: string; stdout?: string }[];
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  code: string;
  source: string;
  createdAt: string;
}

const QuizPreviewPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [publishAt, setPublishAt] = useState<string>('');
  
  // Debug quiz state changes
  useEffect(() => {
    console.log('QuizPreviewPage: quiz state changed:', quiz);
    if (quiz) {
      console.log('QuizPreviewPage: quiz.questions:', quiz.questions);
      console.log('QuizPreviewPage: quiz.questions.length:', quiz.questions?.length);
    }
  }, [quiz]);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    options: ['', '', '', ''],
    answer: 'A'
  });

  useEffect(() => {
    // Check if user is authenticated and is a teacher
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || user.role !== 'teacher') {
      navigate('/login');
      return;
    }

    // Fetch quiz data
    const fetchQuiz = async () => {
      try {
        // Try to fetch from teacher-quizzes endpoint first
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/teacher-quizzes`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const teacherQuizzes = await response.json();
          console.log('QuizPreviewPage: teacherQuizzes from backend:', teacherQuizzes);
          const foundQuiz = teacherQuizzes.find((q: any) => q.id.toString() === quizId);
          console.log('QuizPreviewPage: foundQuiz:', foundQuiz);
          
          if (foundQuiz) {
            console.log('QuizPreviewPage: foundQuiz.questions type:', typeof foundQuiz.questions);
            console.log('QuizPreviewPage: foundQuiz.questions value:', foundQuiz.questions);
            
            let questions = [];
            if (foundQuiz.questions) {
              if (typeof foundQuiz.questions === 'string') {
                try {
                  questions = JSON.parse(foundQuiz.questions);
                } catch (error) {
                  console.error('QuizPreviewPage: Error parsing questions JSON:', error);
                  questions = [];
                }
              } else if (Array.isArray(foundQuiz.questions)) {
                questions = foundQuiz.questions;
              } else {
                console.log('QuizPreviewPage: questions is neither string nor array, using empty array');
                questions = [];
              }
            } else {
              console.log('QuizPreviewPage: questions field is missing from backend response, using empty array');
              questions = [];
            }
            
            console.log('QuizPreviewPage: parsed questions:', questions);
            
            setQuiz({
              id: foundQuiz.id.toString(),
              title: foundQuiz.title,
              description: `Quiz for ${foundQuiz.course_name}`,
              questions: questions,
              code: foundQuiz.access_code,
              source: foundQuiz.is_auto_generated ? 'pdf-content' : 'manual',
              createdAt: foundQuiz.created_at
            });
            // Set publish info if present
            if ('is_published' in foundQuiz) {
              setIsPublished(!!foundQuiz.is_published);
            }
            if ('publish_at' in foundQuiz && foundQuiz.publish_at) {
              try {
                const iso = new Date(foundQuiz.publish_at).toISOString().slice(0,16);
                setPublishAt(iso);
              } catch (_) {
                // ignore parsing issues
              }
            }
          } else {
            // Fallback to localStorage
            console.log('QuizPreviewPage: Quiz not found in backend, trying localStorage');
            const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
            console.log('QuizPreviewPage: generatedQuizzes from localStorage:', generatedQuizzes);
            const foundLocalQuiz = generatedQuizzes.find((q: any) => q.id === quizId || q.id.toString() === quizId);
            console.log('QuizPreviewPage: foundLocalQuiz:', foundLocalQuiz);
            
            if (foundLocalQuiz) {
              console.log('QuizPreviewPage: foundLocalQuiz.questions:', foundLocalQuiz.questions);
              setQuiz(foundLocalQuiz);
            } else {
              alert('Quiz not found');
              navigate('/teacher-dashboard');
            }
          }
        } else {
          // Fallback to localStorage
          const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
          const foundQuiz = generatedQuizzes.find((q: any) => q.id === quizId || q.id.toString() === quizId);
          
          if (foundQuiz) {
            setQuiz(foundQuiz);
          } else {
            alert('Quiz not found');
            navigate('/teacher-dashboard');
          }
        }
      } catch (error) {
        console.error('QuizPreviewPage: Error fetching quiz:', error);
        // Fallback to localStorage
        console.log('QuizPreviewPage: Backend error, trying localStorage fallback');
        const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
        console.log('QuizPreviewPage: generatedQuizzes from localStorage (catch):', generatedQuizzes);
        const foundQuiz = generatedQuizzes.find((q: any) => q.id === quizId || q.id.toString() === quizId);
        console.log('QuizPreviewPage: foundQuiz from localStorage (catch):', foundQuiz);
        
        if (foundQuiz) {
          console.log('QuizPreviewPage: foundQuiz.questions (catch):', foundQuiz.questions);
          setQuiz(foundQuiz);
        } else {
          alert('Quiz not found');
          navigate('/teacher-dashboard');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, navigate]);

  const handleEditQuestion = (index: number) => {
    const question = quiz?.questions[index];
    if (question) {
      const opts = Array.isArray(question.options) ? [...question.options] : ['', '', '', ''];
      const ans = (typeof question.answer === 'string' && question.answer) ? question.answer : 'A';
      setNewQuestion({
        question: question.question,
        options: opts,
        answer: ans
      });
      setEditingQuestion(index);
    }
  };

  const handleSaveQuestion = () => {
    if (!quiz || editingQuestion === null) return;

    const updatedQuestions = [...quiz.questions];
    updatedQuestions[editingQuestion] = {
      ...updatedQuestions[editingQuestion],
      question: newQuestion.question,
      options: newQuestion.options,
      answer: newQuestion.answer
    };

    setQuiz({
      ...quiz,
      questions: updatedQuestions
    });

    // Update localStorage
    const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
    const updatedQuizzes = generatedQuizzes.map((q: any) => 
      q.id === quiz.id ? { ...q, questions: updatedQuestions } : q
    );
    localStorage.setItem('generatedQuizzes', JSON.stringify(updatedQuizzes));

    setEditingQuestion(null);
    setNewQuestion({ question: '', options: ['', '', '', ''], answer: 'A' });
  };

  const handleDeleteQuestion = async (index: number) => {
    if (!quiz || !confirm('Are you sure you want to delete this question?')) return;

    const updatedQuestions = quiz.questions.filter((_, i) => i !== index);
    setQuiz({
      ...quiz,
      questions: updatedQuestions
    });

    // Update localStorage copy
    try {
      const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
      const updatedQuizzes = generatedQuizzes.map((q: any) => 
        String(q.id) === String(quiz.id) ? { ...q, questions: updatedQuestions } : q
      );
      localStorage.setItem('generatedQuizzes', JSON.stringify(updatedQuizzes));
    } catch {}

    // Best-effort backend update if quiz exists there (persist updated questions)
    try {
      const token = localStorage.getItem('authToken') || '';
      await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: updatedQuestions })
      }).catch(() => {});
    } catch {}
  };

  const handleAddQuestion = () => {
    if (!quiz || !newQuestion.question.trim() || newQuestion.options.some(opt => !opt.trim())) {
      alert('Please fill in all fields');
      return;
    }

    const newQuestionObj: Question = {
      id: Date.now(),
      question: newQuestion.question,
      options: newQuestion.options,
      answer: newQuestion.answer
    };

    const updatedQuestions = [...quiz.questions, newQuestionObj];
    setQuiz({
      ...quiz,
      questions: updatedQuestions
    });

    // Update localStorage
    const generatedQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
    const updatedQuizzes = generatedQuizzes.map((q: any) => 
      q.id === quiz.id ? { ...q, questions: updatedQuestions } : q
    );
    localStorage.setItem('generatedQuizzes', JSON.stringify(updatedQuizzes));

    setNewQuestion({ question: '', options: ['', '', '', ''], answer: 'A' });
  };

  const handleCancelEdit = () => {
    setEditingQuestion(null);
    setNewQuestion({ question: '', options: ['', '', '', ''], answer: 'A' });
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
            <p className="text-gray-600">Loading quiz preview...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <i className="ri-error-warning-line text-4xl text-red-500 mb-4"></i>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Quiz Not Found</h2>
            <p className="text-gray-600 mb-4">The quiz you're looking for doesn't exist.</p>
            <Link 
              to="/teacher-dashboard"
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              <i className="ri-arrow-left-line mr-2"></i>
              Back to Dashboard
            </Link>
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
          {/* Header */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{quiz.title}</h1>
                <p className="text-gray-600 mt-1">{quiz.description}</p>
                <div className="flex items-center mt-3 space-x-4">
                  <span className="text-sm text-gray-500">
                    <i className="ri-file-list-3-line mr-1"></i>
                    {quiz.questions.length} questions
                  </span>
                  <span className="text-sm text-gray-500">
                    <i className="ri-key-line mr-1"></i>
                    Code: {quiz.code}
                  </span>
                  {quiz.source === 'pdf-content' && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      PDF Generated
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex space-x-2">
                <Link
                  to="/teacher-dashboard"
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <i className="ri-arrow-left-line mr-2"></i>
                  Back to Dashboard
                </Link>
                <Link
                  to={`/quiz/${quiz.id}?preview=true`}
                  target="_blank"
                  className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                >
                  <i className="ri-eye-line mr-2"></i>
                  Preview as Student
                </Link>
                {isPublished ? (
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('authToken') || '';
                        const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/${quiz.id}/unpublish`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (resp.ok) {
                          setIsPublished(false);
                          alert('Quiz unpublished');
                        } else {
                          const data = await resp.json().catch(() => ({}));
                          alert(`Failed to unpublish: ${data.error || resp.statusText}`);
                        }
                      } catch (e) {
                        console.error(e);
                        alert('Failed to unpublish');
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                  >
                    <i className="ri-eye-off-line mr-2"></i>
                    Unpublish
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('authToken') || '';
                        const body: any = publishAt ? { publish_at: new Date(publishAt).toISOString() } : {};
                        const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/${quiz.id}/publish`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify(body)
                        });
                        if (resp.ok) {
                          setIsPublished(true);
                          alert('Quiz published');
                        } else {
                          const data = await resp.json().catch(() => ({}));
                          alert(`Failed to publish: ${data.error || resp.statusText}`);
                        }
                      } catch (e) {
                        console.error(e);
                        alert('Failed to publish');
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    <i className="ri-check-double-line mr-2"></i>
                    Publish
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publish date/time (optional)</label>
                <input
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-gray-500 mt-1">If set, students see the quiz at this time.</p>
              </div>
              <div className="flex items-end">
                <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                  {isPublished ? 'Published' : 'Not Published'}
                </span>
              </div>
            </div>
          </div>

          {/* Questions List */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Quiz Questions</h2>
            
            {quiz.questions.length === 0 ? (
              <div className="text-center py-8">
                <i className="ri-questionnaire-line text-4xl text-gray-300 mb-2"></i>
                <p className="text-gray-500">No questions in this quiz yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {quiz.questions.map((question, index) => (
                  <div key={question.id || `question-${index}`} className="border border-gray-200 rounded-lg p-4">
                    {editingQuestion === index ? (
                      // Edit Mode
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Question
                          </label>
                          <textarea
                            value={newQuestion.question}
                            onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                            rows={3}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Options
                          </label>
                          <div className="space-y-2">
                            {newQuestion.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center space-x-2">
                                <span className="w-6 text-sm font-medium text-gray-600">
                                  {String.fromCharCode(65 + optIndex)}.
                                </span>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    const newOptions = [...newQuestion.options];
                                    newOptions[optIndex] = e.target.value;
                                    setNewQuestion({ ...newQuestion, options: newOptions });
                                  }}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Correct Answer
                          </label>
                          <select
                            value={newQuestion.answer}
                            onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                          </select>
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveQuestion}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                          >
                            <i className="ri-check-line mr-1"></i>
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            <i className="ri-close-line mr-1"></i>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-medium text-gray-800">
                            Question {index + 1}
                          </h3>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditQuestion(index)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              <i className="ri-edit-line mr-1"></i>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              <i className="ri-delete-bin-line mr-1"></i>
                              Delete
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-gray-700 mb-3">{question.question}</p>
                        {question.type === 'code' ? (
                          <div className="text-sm text-gray-700 space-y-2">
                            <div>
                              <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded mr-2">Coding</span>
                              <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{question.language || 'python'}</span>
                            </div>
                            {question.starterCode && (
                              <pre className="bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto text-xs">{question.starterCode}</pre>
                            )}
                            {Array.isArray(question.testCases) && question.testCases.length > 0 && (
                              <div className="text-xs text-gray-600">Test cases: {question.testCases.length}</div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {Array.isArray(question.options) && question.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center space-x-2">
                                <span className={`w-6 text-sm font-medium ${
                                  (question.answer && String.fromCharCode(65 + optIndex) === question.answer)
                                    ? 'text-green-600'
                                    : 'text-gray-600'
                                }`}>
                                  {String.fromCharCode(65 + optIndex)}.
                                </span>
                                <span className={`${
                                  (question.answer && String.fromCharCode(65 + optIndex) === question.answer)
                                    ? 'text-green-700 font-medium'
                                    : 'text-gray-700'
                                }`}>
                                  {option}
                                </span>
                                {question.answer && String.fromCharCode(65 + optIndex) === question.answer && (
                                  <i className="ri-check-line text-green-600"></i>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Question */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Question</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question
                </label>
                <textarea
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  placeholder="Enter your question here..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Options
                </label>
                <div className="space-y-2">
                  {newQuestion.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center space-x-2">
                      <span className="w-6 text-sm font-medium text-gray-600">
                        {String.fromCharCode(65 + optIndex)}.
                      </span>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...newQuestion.options];
                          newOptions[optIndex] = e.target.value;
                          setNewQuestion({ ...newQuestion, options: newOptions });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correct Answer
                </label>
                <select
                  value={newQuestion.answer}
                  onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              
              <button
                onClick={handleAddQuestion}
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                <i className="ri-add-line mr-2"></i>
                Add Question
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default QuizPreviewPage;
