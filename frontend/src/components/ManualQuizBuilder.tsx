import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Course = {
  id: number;
  title: string;
  description?: string;
};

type NewQuestion = {
  id: number;
  question: string;
  options: string[];
  answer: string; // MCQ: A-D; Code: expected output (optional)
  type?: 'mcq' | 'code';
  language?: string;
  starterCode?: string;
};

type Props = {
  onCreated?: (quizId: string) => void;
};

const ManualQuizBuilder: React.FC<Props> = ({ onCreated }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [publishAt, setPublishAt] = useState<string>('');
  const [questions, setQuestions] = useState<NewQuestion[]>([{
    id: Date.now(),
    question: '',
    options: ['', '', '', ''],
    answer: 'A',
    type: 'mcq',
    language: 'python',
    starterCode: ''
  }]);

  const canSubmit = useMemo(() => {
    if (!selectedCourseId || !title.trim() || durationMinutes < 5) return false;
    if (questions.length === 0) return false;
    return questions.every(q => {
      if (!q.question.trim()) return false;
      if ((q.type || 'mcq') === 'mcq') {
        return q.options.every(o => o.trim());
      }
      return true;
    });
  }, [selectedCourseId, title, durationMinutes, questions]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    const fetchCourses = async () => {
      try {
        const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/$/, '');
        const resp = await fetch(`${apiBase}/api/quiz/teacher-courses`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          setCourses(data || []);
        }
      } catch (e) {
        // ignore silently, UI will still allow manual entry
      }
    };
    fetchCourses();
  }, []);

  const updateQuestion = (idx: number, updater: (q: NewQuestion) => NewQuestion) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? updater(q) : q));
  };

  const addQuestion = () => {
    setQuestions(prev => ([...prev, { id: Date.now(), question: '', options: ['', '', '', ''], answer: 'A', type: 'mcq', language: 'python', starterCode: '' }]));
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken') || '';
      const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/$/, '');

      // Prepare payload for backend create endpoint
      const payload = {
        course_id: selectedCourseId,
        title: title.trim(),
        duration_minutes: durationMinutes,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          // Store letter answer as expected by app conversions
          answer: q.answer
        }))
      };

      const resp = await fetch(`${apiBase}/api/quiz/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({} as any));
        alert(`Failed to create quiz: ${err?.error || resp.statusText}`);
        setLoading(false);
        return;
      }

      const data = await resp.json();
      const quizId = String(data.quiz_id);
      const accessCode = data.access_code;

      // Persist to local storage so preview/edit pages have immediate access
      try {
        const existing = JSON.parse(localStorage.getItem('generatedQuizzes') || '[]');
        const stored = {
          id: quizId,
          title: title.trim(),
          description: `Quiz for selected course`,
          questions: payload.questions.map(q => ({ id: q.id, question: q.question, options: q.options, answer: q.answer })),
          code: accessCode,
          createdAt: new Date().toISOString(),
          duration: durationMinutes,
          source: 'manual',
          settings: {
            timeLimit: durationMinutes,
            preventTabSwitch: true,
            randomizeQuestions: true,
            showOneQuestionAtATime: true,
            requireWebcam: false
          }
        } as any;
        const updated = [...existing.filter((q: any) => String(q.id) !== quizId), stored];
        localStorage.setItem('generatedQuizzes', JSON.stringify(updated));
      } catch {}

      // Navigate to preview for publish/schedule
      if (publishAt) {
        // Best-effort publish immediately with schedule
        try {
          const body: any = publishAt ? { publish_at: new Date(publishAt).toISOString() } : {};
          await fetch(`${apiBase}/api/quiz/${quizId}/publish`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }).catch(() => {});
        } catch {}
      }

      if (onCreated) onCreated(quizId);
      navigate(`/quiz-preview/${quizId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Generate Quiz Manually</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select a course</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter quiz title"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <input
              type="number"
              min={5}
              max={180}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value || '0', 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publish date/time (optional)</label>
            <input
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-800">Questions</h3>
            <button onClick={addQuestion} className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary/90">
              <i className="ri-add-line mr-1"></i>
              Add Question
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question {idx + 1}</label>
                  {questions.length > 1 && (
                    <button onClick={() => removeQuestion(idx)} className="text-red-600 hover:text-red-700 text-sm">
                      <i className="ri-delete-bin-line mr-1"></i>
                      Remove
                    </button>
                  )}
                </div>
                <textarea
                  value={q.question}
                  onChange={(e) => updateQuestion(idx, (qq) => ({ ...qq, question: e.target.value }))}
                  rows={3}
                  placeholder="Enter question text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary mb-3"
                />
                { (q.type || 'mcq') !== 'code' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt, oIdx) => (
                        <div key={`${q.id}-${oIdx}`} className="flex items-center space-x-2">
                          <span className="w-6 text-sm font-medium text-gray-600">{String.fromCharCode(65 + oIdx)}.</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateQuestion(idx, (qq) => {
                              const updated = [...qq.options];
                              updated[oIdx] = e.target.value;
                              return { ...qq, options: updated };
                            })}
                            placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                      <select
                        value={q.answer}
                        onChange={(e) => updateQuestion(idx, (qq) => ({ ...qq, answer: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                        <select
                          value={q.language || 'python'}
                          onChange={(e) => updateQuestion(idx, (qq) => ({ ...qq, language: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="python">Python</option>
                          <option value="javascript">JavaScript</option>
                          <option value="cpp">C++</option>
                          <option value="java">Java</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Starter Code (optional)</label>
                      <textarea
                        value={q.starterCode || ''}
                        onChange={(e) => updateQuestion(idx, (qq) => ({ ...qq, starterCode: e.target.value }))}
                        rows={6}
                        placeholder={`Write starter ${q.language || 'python'} code for students…`}
                        className="w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expected Output (optional)</label>
                      <input
                        type="text"
                        value={q.answer || ''}
                        onChange={(e) => updateQuestion(idx, (qq) => ({ ...qq, answer: e.target.value }))}
                        placeholder="e.g., 42"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            disabled={loading}
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit || loading}
            onClick={handleCreate}
            className={`px-4 py-2 rounded-md text-white ${(!canSubmit || loading) ? 'bg-primary/60' : 'bg-primary hover:bg-primary/90'}`}
          >
            {loading ? 'Creating...' : 'Create Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualQuizBuilder;


