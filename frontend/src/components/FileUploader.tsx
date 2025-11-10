import React, { useState, useRef, ChangeEvent } from 'react';
import { nanoid } from 'nanoid';
import { useNavigate } from 'react-router-dom';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  isActive: boolean;
  duration?: number;
  passingScore?: number;
  quizCode?: string;
  code: string;
  source?: string;
  createdAt: string;
  pdfContent?: string; // PDF content for video suggestions
  settings?: {
    timeLimit: number;
    preventTabSwitch: boolean;
    randomizeQuestions: boolean;
    showOneQuestionAtATime: boolean;
    requireWebcam: boolean;
  };
}

interface FileUploaderProps {
  onQuizGenerated: (quiz: Quiz) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onQuizGenerated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [quizDescription, setQuizDescription] = useState<string>("");
  const [mlStatus, setMlStatus] = useState<string>("");
  const [processingStage, setProcessingStage] = useState<string>("");
  const [showQuizCode, setShowQuizCode] = useState(false);
  const [generatedQuizCode, setGeneratedQuizCode] = useState("");
  const [generatedQuizId, setGeneratedQuizId] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check if the file is a PDF
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        return;
      }
      
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB');
        return;
      }
      
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError(null);
      
      // Auto-generate quiz title from file name
      const nameWithoutExtension = selectedFile.name.replace('.pdf', '');
      setQuizTitle(`Quiz on ${nameWithoutExtension}`);
    }
  };
  
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }
    
    if (!quizTitle) {
      setError('Please provide a quiz title');
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 150);
    
    // Simulate API call for file upload
    setTimeout(() => {
      clearInterval(interval);
      setUploadProgress(100);
      setFileUploaded(true);
      setUploading(false);
      
      // Start quiz generation after successful upload
      generateQuiz();
    }, 2000);
  };
  
  const generateQuiz = async () => {
    setGenerating(true);
    setMlStatus("Uploading PDF and generating quiz...");

    // Prepare form data for PDF upload
    const formData = new FormData();
    formData.append('file', file!);
    formData.append('title', quizTitle);
    formData.append('description', quizDescription);
    formData.append('course_id', '1'); // Use actual course id if available
    formData.append('duration_minutes', '10'); // Or let user select

    try {
      // Call your backend API
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/quiz/generate`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate quiz');
      }

      const responseData = await response.json();
      const questions = JSON.parse(responseData.quiz);
      
      // Use the access_code from the backend response
      const quizCode = responseData.access_code;
      
      const generatedQuiz = {
        id: responseData.quiz_id.toString(),
        title: quizTitle,
        description: quizDescription,
        pdfContent: responseData.pdf_content || '', // Store PDF content for video suggestions
        questions: questions.map((q: any, idx: number) => {
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
            options: options,
            correctAnswer: correctAnswer
          };
        }),
        isActive: false,
        duration: 10,
        passingScore: 60,
        quizCode: quizCode,
        code: quizCode,
        settings: {
          timeLimit: 10,
          preventTabSwitch: true,
          randomizeQuestions: true,
          showOneQuestionAtATime: true,
          requireWebcam: false
        },
        createdAt: new Date().toISOString(),
        source: 'pdf-content'
      };
      
      // Save the quiz code to localStorage for student access
      const existingCodes = JSON.parse(localStorage.getItem('quizCodes') || '[]');
      localStorage.setItem('quizCodes', JSON.stringify([...existingCodes, quizCode]));
      
      // Append the new quiz to the array in localStorage
      const existingQuizzes = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
      localStorage.setItem('generatedQuizzes', JSON.stringify([...existingQuizzes, generatedQuiz]));
      
      // Also store in a shared location for immediate student access
      const studentAccessibleQuizzes = JSON.parse(localStorage.getItem('studentAccessibleQuizzes') || '[]');
      const studentQuiz = {
        ...generatedQuiz,
        isActive: true, // Make it immediately available to students
        scheduledDate: new Date().toISOString()
      };
      localStorage.setItem('studentAccessibleQuizzes', JSON.stringify([...studentAccessibleQuizzes, studentQuiz]));
      
      console.log('Saved quizzes:', JSON.parse(localStorage.getItem('generatedQuizzes') || '[]'));
      console.log('Navigating to quiz:', generatedQuiz.id);
      console.log('Backend response:', responseData);
      console.log('Quiz code generated:', quizCode);

      // Set the quiz code and show the interface
      setGeneratedQuizCode(quizCode);
      setGeneratedQuizId(generatedQuiz.id);
      setShowQuizCode(true);
      console.log('Setting showQuizCode to true, quizCode:', quizCode);

      // Call the parent callback
      onQuizGenerated(generatedQuiz);
    } catch (err) {
      setError('Failed to generate quiz. Please try again.');
      setGenerating(false);
      return;
    }

    setGenerating(false);
    // Don't reset form here - let the quiz code interface stay visible
  };
  
  const createSampleQuizFromPdf = (): Quiz => {
    // Generate a random code (6 characters)
    const quizCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    return {
      id: nanoid(),
      title: quizTitle,
      description: quizDescription,
      questions: [
        {
          id: 1,
          question: "What is the main topic covered in this PDF?",
          options: [
            "The content from the uploaded PDF",
            "Something unrelated to the PDF",
            "Random information",
            "None of the above"
          ],
          correctAnswer: "The content from the uploaded PDF",
          explanation: "This question is based on the main subject of the uploaded document."
        },
        {
          id: 2,
          question: "According to the PDF, which concept is most important?",
          options: [
            "Key concept from the PDF",
            "Unrelated concept",
            "Partially related concept",
            "Concept mentioned briefly"
          ],
          correctAnswer: "Key concept from the PDF",
          explanation: "This represents a central idea discussed extensively in the document."
        },
        {
          id: 3,
          question: "What conclusion can be drawn from the material?",
          options: [
            "Conclusion based on PDF content",
            "Opposite conclusion",
            "Unrelated conclusion",
            "No conclusion possible"
          ],
          correctAnswer: "Conclusion based on PDF content",
          explanation: "This follows directly from the information presented in the document."
        },
        {
          id: 4,
          question: "Which of these terms appears most frequently in the document?",
          options: [
            "Important term from PDF",
            "Term not in the PDF",
            "Rarely mentioned term",
            "Generic term"
          ],
          correctAnswer: "Important term from PDF",
          explanation: "This term appears repeatedly throughout the document, indicating its significance."
        },
        {
          id: 5,
          question: "What is a practical application of the knowledge in this PDF?",
          options: [
            "Relevant application",
            "Unrelated application",
            "Theoretical application only",
            "No practical applications"
          ],
          correctAnswer: "Relevant application",
          explanation: "This represents how the information can be applied in real-world contexts."
        }
      ],
      isActive: false,
      duration: 600, // 10 minutes in seconds
      passingScore: 60,
      quizCode: quizCode,
      code: quizCode,
      createdAt: new Date().toISOString(),
      source: 'pdf-content'
    };
  };
  
  const resetForm = () => {
    setFile(null);
    setFileName("");
    setFileUploaded(false);
    setQuizTitle("");
    setQuizDescription("");
    setUploadProgress(0);
    setMlStatus("");
    setProcessingStage("");
    setShowQuizCode(false);
    setGeneratedQuizCode("");
    setGeneratedQuizId("");
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Upload Course Materials</h2>
      

      
      {!fileUploaded || (!generating && !showQuizCode) ? (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload PDF Notes</label>
            <div className="mt-1 flex items-center">
              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
                ref={fileInputRef}
                accept=".pdf"
              />
              <button
                type="button"
                onClick={handleBrowseClick}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Browse Files
              </button>
              <span className="ml-3 text-sm text-gray-500">
                {fileName ? fileName : 'No file selected'}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Upload a PDF file (max 10MB)
            </p>
          </div>
          
          {file && (
            <>
              <div className="mb-4">
                <label htmlFor="quizTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Quiz Title
                </label>
                <input
                  type="text"
                  id="quizTitle"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Enter quiz title"
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="quizDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="quizDescription"
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  rows={3}
                  className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Enter a brief description for this quiz"
                />
              </div>
            </>
          )}
          
          {error && (
            <div className="text-sm text-red-600 mb-4">
              {error}
            </div>
          )}
          
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
              !file || uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload and Generate Quiz'}
          </button>
          
          {uploading && (
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div 
                  className="bg-primary h-2.5 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 text-right mt-1">
                {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {generating ? (
            <div className="py-8">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  {mlStatus}
                </h3>
                <p className="text-sm text-gray-500">
                  This may take a minute or two...
                </p>
                
                {/* Processing stages progress */}
                <div className="mt-6 w-full max-w-md">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">Processing Stage</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full" 
                      style={{ 
                        width: processingStage === 'text_extraction' ? '15%' :
                               processingStage === 'structure_analysis' ? '30%' :
                               processingStage === 'concept_extraction' ? '50%' :
                               processingStage === 'question_generation' ? '70%' :
                               processingStage === 'answer_creation' ? '85%' :
                               processingStage === 'finalizing' ? '95%' : '5%'
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ) : showQuizCode ? (
            <div className="py-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                  <i className="ri-check-line text-3xl"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  Quiz Generated Successfully!
                </h3>
                <p className="text-sm text-gray-500">
                  Your quiz has been created and is ready to use.
                </p>
              </div>
              
              {/* Quiz Code Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-md font-medium text-blue-800 mb-3">Quiz Access Code</h4>
                <p className="text-sm text-blue-700 mb-4">
                  Share this code with your students to access the quiz:
                </p>
                
                <div className="flex items-center justify-between bg-white border border-blue-300 rounded-lg p-3 mb-4">
                  <span className="font-mono text-xl font-bold text-blue-600 tracking-wider">
                    {generatedQuizCode}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedQuizCode);
                      // You could add a toast notification here
                    }}
                    className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    <i className="ri-clipboard-line mr-1"></i>
                    Copy
                  </button>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => navigate(`/quiz-preview/${generatedQuizId}`)}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <i className="ri-eye-line mr-2"></i>
                    Preview & Edit Quiz
                  </button>
                  <button
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <i className="ri-add-line mr-2"></i>
                    Generate Another
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                <i className="ri-check-line text-3xl"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Quiz Generated Successfully!
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Your quiz has been created and is ready to use.
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Generate Another Quiz
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploader; 