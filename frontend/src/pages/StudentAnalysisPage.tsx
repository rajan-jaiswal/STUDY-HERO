import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

type Submission = {
  id: number;
  quiz_id: number;
  student_id: number;
  student_name: string;
  answers: string | string[];
  score: number;
  submitted_at: string;
};

type Question = {
  question: string;
  options: string[];
  answer?: string; // letter A-D in new format
};

type Quiz = {
  id: number;
  title: string;
  questions?: Question[] | string; // may be JSON string
};

const StudentAnalysisPage: React.FC = () => {
  const { quizId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshMs] = useState<number>(15000);

  const fetchAll = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/$/, '');

        const safeJson = async (res: Response) => {
          const ct = res.headers.get('content-type') || '';
          const text = await res.text();
          if (!res.ok) {
            throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
          }
          if (!ct.includes('application/json')) {
            throw new Error(`Unexpected response (not JSON): ${text.slice(0, 200)}`);
          }
          try {
            return JSON.parse(text);
          } catch (e: any) {
            throw new Error(`Invalid JSON: ${e.message}. Body: ${text.slice(0, 200)}`);
          }
        };

        const [resultsRes, teacherQuizzesRes] = await Promise.all([
          fetch(`${apiBase}/api/quiz/${quizId}/results`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${apiBase}/api/quiz/teacher-quizzes`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const results: Submission[] = await safeJson(resultsRes);
        setSubmissions(results);

        const teacherQuizzes: Quiz[] = await safeJson(teacherQuizzesRes);
        const found = teacherQuizzes.find(q => String(q.id) === String(quizId)) || null;
        setQuiz(found);
        setLastUpdated(new Date());
      } catch (e: any) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
  }, [quizId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchAll();
    }, autoRefreshMs);
    return () => clearInterval(id);
  }, [fetchAll, autoRefreshMs]);

  const parsedQuestions: Question[] = useMemo(() => {
    if (!quiz || !quiz.questions) return [];
    const raw = quiz.questions as any;
    if (Array.isArray(raw)) return raw as Question[];
    try {
      const parsed = JSON.parse(raw as string);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [quiz]);

  // Convert answer letter to option text for comparison/display
  const getCorrectAnswerText = (q: Question): string | undefined => {
    if (!q.answer || !q.options) return undefined;
    const idx = (q.answer.charCodeAt(0) - 65) | 0;
    return q.options[idx];
  };

  // Parse submission answers into array of strings (letters)
  const parseAnswers = (ans: string | string[]): string[] => {
    if (Array.isArray(ans)) return ans as string[];
    try {
      const parsed = JSON.parse(ans);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    if (typeof ans === 'string') return ans.split(',').map(s => s.trim());
    return [];
  };

  const perQuestionStats = useMemo(() => {
    const total = submissions.length;
    const stats = parsedQuestions.map((q, idx) => ({
      index: idx,
      question: q.question,
      total,
      correct: 0,
      incorrect: 0,
      commonWrongOptions: new Map<string, number>()
    }));

    submissions.forEach(sub => {
      const answers = parseAnswers(sub.answers);
      parsedQuestions.forEach((q, idx) => {
        const chosen = answers[idx];
        const correctLetter = q.answer;
        const isCorrect = chosen && correctLetter && chosen.trim() === correctLetter.trim();
        if (isCorrect) {
          (stats[idx] as any).correct += 1;
        } else {
          (stats[idx] as any).incorrect += 1;
          if (chosen && q.options) {
            const optionIdx = chosen.charCodeAt(0) - 65;
            const optText = q.options[optionIdx];
            if (optText) {
              const map = stats[idx].commonWrongOptions;
              map.set(optText, (map.get(optText) || 0) + 1);
            }
          }
        }
      });
    });

    return stats;
  }, [submissions, parsedQuestions]);

  const classSummary = useMemo(() => {
    const totalStudents = submissions.length;
    const totalQuestions = parsedQuestions.length;
    if (totalStudents === 0 || totalQuestions === 0) {
      return { totalStudents, totalQuestions, totalAttempts: 0, totalCorrect: 0, masteryRate: 0, avgScore: 0 };
    }
    let totalCorrect = 0;
    submissions.forEach(sub => {
      const answers = parseAnswers(sub.answers);
      parsedQuestions.forEach((q, idx) => {
        const chosen = answers[idx];
        const correctLetter = q.answer;
        if (chosen && correctLetter && chosen.trim() === correctLetter.trim()) {
          totalCorrect += 1;
        }
      });
    });
    const totalAttempts = totalStudents * totalQuestions;
    const masteryRate = totalAttempts === 0 ? 0 : totalCorrect / totalAttempts;
    const avgScore = totalStudents === 0 ? 0 : (submissions.reduce((acc, s) => acc + (Number(s.score) || 0), 0) / totalStudents);
    return { totalStudents, totalQuestions, totalAttempts, totalCorrect, masteryRate, avgScore };
  }, [submissions, parsedQuestions]);

  const extractTopics = (text: string): string[] => {
    const t = text.toLowerCase();
    const topics: { [k: string]: string[] } = {
      'Big Data': ['big data', 'hadoop', 'spark', 'velocity', 'variety', 'volume', 'veracity', 'distributed'],
      'Data Science': ['regression', 'classification', 'clustering', 'analytics', 'statistics', 'model'],
      'Computer Networks': ['network', 'protocol', 'tcp', 'udp', 'routing', 'latency'],
      'Databases': ['database', 'sql', 'schema', 'transaction', 'index', 'table', 'query'],
      'Algorithms': ['algorithm', 'complexity', 'graph', 'tree', 'search', 'sort'],
      'Programming': ['code', 'program', 'function', 'variable', 'loop', 'class', 'object'],
      'Web Development': ['html', 'css', 'javascript', 'react', 'frontend', 'backend', 'api']
    };
    const found: string[] = [];
    Object.entries(topics).forEach(([name, keys]) => {
      if (keys.some(k => t.includes(k))) found.push(name);
    });
    return found.length ? found : ['General Concepts from PDF'];
  };

  // Extract specific concept terms from a question text
  const extractKeyTerms = (text: string, limit = 5): string[] => {
    const stop = new Set([
      'the','a','an','and','or','in','on','at','to','for','of','with','by','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','can','this','that','these','those','what','which','who','when','where','why','how','from','into','about','not','than','then','it','its','as','also','using','use','following','choose','select','statement','statements','question','questions','true','false','correct','incorrect','associated','characterize','scenario','structured','challenge','big','data'
    ]);
    const words = (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w));
    const freq: Record<string, number> = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq)
      .sort((a,b) => b[1]-a[1])
      .slice(0, limit)
      .map(([w]) => w);
  };

  const revisionSuggestions = useMemo(() => {
    // Aggregate by concept/topic with total incorrect answers across associated questions
    const topicMap: Map<string, { incorrectCount: number; questionCount: number }> = new Map();
    perQuestionStats.forEach((s) => {
      if (s.incorrect > 0) {
        const topics = extractTopics(s.question);
        topics.forEach(tp => {
          const entry = topicMap.get(tp) || { incorrectCount: 0, questionCount: 0 };
          entry.incorrectCount += s.incorrect;
          entry.questionCount += 1;
          topicMap.set(tp, entry);
        });
      }
    });
    return Array.from(topicMap.entries())
      .sort((a,b) => b[1].incorrectCount - a[1].incorrectCount)
      .map(([topic, data]) => ({ topic, incorrectCount: data.incorrectCount, questionCount: data.questionCount }));
  }, [perQuestionStats]);

  type Insight = {
    cluster: string;
    explanation1: string;
    explanation2: string;
    misconceptions: string[];
    actions: string[];
  };

  const teacherReadyInsights: Insight[] = useMemo(() => {
    const insights: Insight[] = [];
    revisionSuggestions.slice(0, 5).forEach((s) => {
      // Gather terms, misconceptions, and refs for this topic
      const terms = new Set<string>();
      const misconceptions: string[] = [];
      perQuestionStats.forEach((pq) => {
        const tps = extractTopics(pq.question);
        if (tps.includes(s.topic)) {
          extractKeyTerms(pq.question).forEach(k => terms.add(k));
          if (pq.commonWrongOptions && pq.commonWrongOptions.size > 0) {
            const topWrong = Array.from(pq.commonWrongOptions.entries()).sort((a,b)=>b[1]-a[1])[0];
            if (topWrong) {
              misconceptions.push(`Students often confuse it with "${topWrong[0]}".`);
            }
          }
        }
      });

      const topTerms = Array.from(terms).slice(0, 3);
      const clusterFromTopic: Record<string, string> = {
        'Big Data': 'Big Data Fundamentals',
        'Databases': 'Storage & Database Systems',
        'Data Science': 'Data Science Basics',
        'Computer Networks': 'Networking Essentials',
        'Algorithms': 'Algorithmic Thinking',
        'Programming': 'Programming Foundations',
        'Web Development': 'Web Development Concepts',
        'General Concepts from PDF': 'Core Concepts from Material'
      };
      const cluster = clusterFromTopic[s.topic] || s.topic;

      const explanation1 = topTerms.length > 0
        ? `Many students struggled with ${cluster}, especially around ${topTerms.join(', ')}.`
        : `Many students struggled with ${cluster}.`;

      const explanation2 = s.incorrectCount > 0
        ? `${s.incorrectCount} incorrect response${s.incorrectCount === 1 ? '' : 's'} across ${s.questionCount} question${s.questionCount === 1 ? '' : 's'} indicate partial understanding.`
        : `Responses indicate minor gaps but no major misconceptions.`;

      const actions = [
        topTerms.length > 0 ? `Revise definitions and examples of ${topTerms.join(', ')}.` : `Revise key definitions with quick examples.`,
        `Provide real-world cases to contrast correct vs. common mistakes.`,
        `Use a 3-minute recap: think-pair-share on a sample question.`
      ];

      insights.push({
        cluster,
        explanation1,
        explanation2,
        misconceptions: misconceptions.slice(0, 2),
        actions
      });
    });
    return insights;
  }, [revisionSuggestions, perQuestionStats]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <p className="text-gray-600">Loading analysis…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Student Analysis</h1>
          {lastUpdated && (
            <div className="text-xs text-gray-500 mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={fetchAll} className="px-3 py-1.5 rounded bg-primary text-white hover:opacity-90 text-sm">Refresh</button>
          <Link to="/teacher-dashboard" className="text-primary hover:underline text-sm">Back to Dashboard</Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 mb-8">
        <h2 className="text-lg font-semibold text-gray-800">Class Summary</h2>
        {classSummary.totalStudents === 0 ? (
          <p className="text-gray-600 mt-1">No submissions yet. Once students attempt the quiz, you'll see mastery and topics to reteach.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
            <div className="p-3 bg-gray-50 rounded border"><div className="text-gray-500">Students</div><div className="text-gray-900 font-semibold">{classSummary.totalStudents}</div></div>
            <div className="p-3 bg-gray-50 rounded border"><div className="text-gray-500">Questions</div><div className="text-gray-900 font-semibold">{classSummary.totalQuestions}</div></div>
            <div className="p-3 bg-gray-50 rounded border"><div className="text-gray-500">Mastery Rate</div><div className="text-gray-900 font-semibold">{Math.round(classSummary.masteryRate * 100)}%</div></div>
            <div className="p-3 bg-gray-50 rounded border"><div className="text-gray-500">Avg Score</div><div className="text-gray-900 font-semibold">{Math.round(classSummary.avgScore)}/{classSummary.totalQuestions}</div></div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-5 mb-8">
        <h2 className="text-lg font-semibold text-gray-800">Quiz Overview</h2>
        <p className="text-gray-600 mt-1">{quiz?.title}</p>
        <p className="text-gray-600 mt-1">Submissions: {submissions.length}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-5 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Per-Question Performance (Clustered Columns)</h2>
        <p className="text-sm text-gray-600 mb-4">X-axis: Question number • Y-axis: Number of students</p>
        {/* Legend and cohort size */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2"><span className="inline-block w-3 h-3 bg-green-500 rounded-sm"></span><span>Correct</span></div>
            <div className="flex items-center space-x-2"><span className="inline-block w-3 h-3 bg-red-500 rounded-sm"></span><span>Incorrect</span></div>
          </div>
          <div className="text-xs md:text-sm text-gray-700 bg-gray-100 border rounded px-2 py-1">
            Students attempted: {classSummary.totalStudents}
          </div>
        </div>
        {/* Responsive vertical clustered columns */}
        <div className="w-full overflow-x-auto">
          <div className="flex items-end space-x-3 md:space-x-4 h-56 md:h-64 border-b pb-2">
            {perQuestionStats.map((s, idx) => {
              const maxY = Math.max(1, s.total);
              const correctHeight = (s.correct / maxY) * 100;
              const wrongHeight = (s.incorrect / maxY) * 100;
              return (
                <div key={idx} className="flex flex-col items-center min-w-[30px]">
                  <div className="flex items-end space-x-1 h-44 md:h-52">
                    <div className="w-3 md:w-4 bg-green-500 rounded-sm" style={{ height: `${correctHeight}%` }} title={`Q${idx + 1}: Correct ${s.correct}`} />
                    <div className="w-3 md:w-4 bg-red-500 rounded-sm" style={{ height: `${wrongHeight}%` }} title={`Q${idx + 1}: Incorrect ${s.incorrect}`} />
                  </div>
                  <div className="text-xs text-gray-700 mt-1">Q{idx + 1}</div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Questions →</div>
        </div>
      </div>

      {/* Teacher-ready Insights (moved below chart) */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-lg font-semibold text-gray-800">Teacher-ready Insights</h2>
        {teacherReadyInsights.length === 0 ? (
          <p className="text-gray-600 mt-1">Insights will appear here as soon as students start submitting responses.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-1 md:grid-cols-2 text-sm">
            {teacherReadyInsights.map((ins, i) => (
              <div key={i} className="border rounded p-3 bg-gray-50">
                <div className="text-gray-900 font-semibold">✅ <span className="font-bold">Topic to Revise</span>: <span className="underline decoration-primary/50 decoration-2 underline-offset-2">{ins.cluster}</span></div>
                <ul className="list-disc pl-5 mt-1 text-gray-800">
                  <li>{ins.explanation1}</li>
                  <li>{ins.explanation2}</li>
                </ul>
                <div className="mt-2 text-gray-900 font-semibold">⚠️ Common Misconceptions</div>
                <ul className="list-disc pl-5 mt-1 text-gray-800">
                  {ins.misconceptions.length > 0 ? ins.misconceptions.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  )) : <li>No dominant misconception detected.</li>}
                </ul>
                <div className="mt-2 text-gray-900 font-semibold">📌 Teacher Action Guide</div>
                <ul className="list-disc pl-5 mt-1 text-gray-800">
                  {ins.actions.map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAnalysisPage;




