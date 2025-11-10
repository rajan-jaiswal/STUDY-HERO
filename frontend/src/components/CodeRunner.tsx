import React, { useState, useRef, useEffect } from 'react';

type Props = {
  initialLanguage?: string;
  initialCode?: string;
  onRun?: (result: any) => void;
  onSubmit?: (code: string) => void;
};

const languages = [
  { label: 'Python', value: 'python' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'C++', value: 'cpp' },
  { label: 'Java', value: 'java' }
];

const CodeRunner: React.FC<Props> = ({ initialLanguage = 'python', initialCode = '', onRun, onSubmit }) => {
  const [language, setLanguage] = useState<string>(initialLanguage);
  const [code, setCode] = useState<string>(initialCode);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [running, setRunning] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [isWaitingForInput, setIsWaitingForInput] = useState<boolean>(false);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedCode, setSubmittedCode] = useState<string>('');
  const terminalRef = useRef<HTMLDivElement>(null);

  const handleRun = async (providedInput: string = '') => {
    try {
      setRunning(true);
      setError('');
      
      // Clear output only on fresh run (not when providing input)
      if (!providedInput) {
        setOutput('');
        setInputValue('');
      }
      
      setIsWaitingForInput(false);
      setCurrentInput('');

      // Use submitted code if available, otherwise use current code
      const codeToRun = isSubmitted ? submittedCode : code;

      const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/$/, '');
      const resp = await fetch(`${apiBase}/api/code/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: JSON.stringify({ language, code: codeToRun, stdin: providedInput })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({} as any));
        setError(err?.error || 'Execution failed');
        setRunning(false);
        return;
      }

      const data = await resp.json();
      
      // Show all output including input prompts and errors
      let terminalOutput = '';
      
      // Combine all output streams to simulate a real terminal
      if (data.compile_output && data.compile_output.trim()) {
        terminalOutput += data.compile_output + '\n';
      }
      if (data.stderr && data.stderr.trim()) {
        terminalOutput += data.stderr + '\n';
      }
      if (data.stdout && data.stdout.trim()) {
        terminalOutput += data.stdout;
      }
      
      // Check if program is waiting for input (EOF error means it tried to read input)
      if (data.stderr && data.stderr.includes('EOFError') && data.stderr.includes('EOF when reading')) {
        // Extract only the prompt message from stdout (not the variable assignment)
        const promptMatch = data.stdout.match(/"([^"]*)"/);
        if (promptMatch) {
          terminalOutput = promptMatch[1] + '\n';
          setIsWaitingForInput(true);
        } else {
          // Fallback: look for common prompt patterns
          const fallbackMatch = data.stdout.match(/(Enter[^:]*:)/) || data.stdout.match(/(Please[^:]*:)/);
          if (fallbackMatch) {
            terminalOutput = fallbackMatch[1] + '\n';
            setIsWaitingForInput(true);
          }
        }
      }
      
      // If no output but there was an error, show it
      if (!terminalOutput.trim() && data.stderr) {
        terminalOutput = data.stderr;
      }
      
      // If input was provided, hide prompt text like "Enter ...:" from final output
      let cleanedOutput = terminalOutput;
      if (providedInput) {
        cleanedOutput = cleanedOutput
          .replace(/^\s*Enter[^:\n]*:\s*/i, '')
          .replace(/^\s*Input[^:\n]*:\s*/i, '')
          .replace(/^\s*Please[^:\n]*:\s*/i, '');
      }

      setOutput(cleanedOutput);
      if (onRun) onRun(data);
    } catch (e: any) {
      setError(e?.message || 'Execution error');
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = () => {
    if (isSubmitted) return; // Can only submit once
    
    setSubmittedCode(code);
    setIsSubmitted(true);
    if (onSubmit) onSubmit(code);
  };

  const handleInputSubmit = async () => {
    if (!isWaitingForInput || !currentInput.trim()) return;
    
    setIsWaitingForInput(false);
    const userInput = currentInput;
    setCurrentInput('');
    
    // Show the input in terminal
    setOutput(prev => prev + userInput + '\n');
    
    // Re-run with the input
    setTimeout(() => {
      handleRun(userInput);
    }, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isWaitingForInput) {
      e.preventDefault();
      handleInputSubmit();
    }
  };

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output, error]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-3">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md"
        >
          {languages.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <button
          onClick={() => handleRun()}
          disabled={running || isWaitingForInput}
          className={`px-4 py-2 rounded-md text-white ${running || isWaitingForInput ? 'bg-blue-500/60' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {running ? 'Running…' : isWaitingForInput ? 'Waiting for input…' : 'Run Code'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitted || running || isWaitingForInput}
          className={`px-4 py-2 rounded-md text-white ${isSubmitted || running || isWaitingForInput ? 'bg-gray-500/60' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {isSubmitted ? 'Code Submitted' : 'Submit Code'}
        </button>
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={10}
        placeholder={`Write your ${language} code here…`}
        className={`w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded-md mb-3 ${isSubmitted ? 'bg-gray-100' : ''}`}
        disabled={isSubmitted}
      />

      {isSubmitted && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            <i className="ri-check-line mr-1"></i>
            Code has been submitted and locked. You can still run it to test.
          </p>
        </div>
      )}

      {(error || output || isWaitingForInput) && (
        <div className="bg-gray-900 text-green-400 border border-gray-200 rounded-md p-3">
          <div className="text-xs text-gray-400 mb-2">Terminal Output</div>
          <div 
            ref={terminalRef}
            className="whitespace-pre-wrap text-sm font-mono min-h-[100px] max-h-[300px] overflow-y-auto"
          >
            {error ? error : output || ''}
            {isWaitingForInput && (
              <div className="flex items-center mt-2">
                <span className="text-green-400">{output.split('\n').pop()}</span>
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-transparent border-none outline-none text-green-400 font-mono flex-1 ml-2"
                  placeholder="Type input here..."
                  autoFocus
                />
                <button
                  onClick={handleInputSubmit}
                  className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeRunner;