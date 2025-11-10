import requests
import os
import sys
import json
from dotenv import load_dotenv
import re
import random

# Load environment variables
load_dotenv()

MISTRAL_API_KEY = os.getenv('MISTRAL_API_KEY')
if not MISTRAL_API_KEY:
    print("❌ Error: MISTRAL_API_KEY not found in environment variables", file=sys.stderr)
    sys.exit(1)

print("✅ Mistral API key loaded", file=sys.stderr)

API_URL = "https://api.mistral.ai/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {MISTRAL_API_KEY}",
    "Content-Type": "application/json"
}

def is_code_prompt(s: str) -> bool:
    s = (s or '').lower()
    patterns = [
        r"write\s+a\s+program",
        r"implement\s+(a|the)\s+function",
        r"complete\s+the\s+function",
        r"create\s+a\s+function",
        r"develop\s+a\s+program",
        r"code\s+(a|the)\s+",
        r"programming\s+",
        r"stdin|stdout|input\(|scanf|printf|System\.out|public\s+static\s+void\s+main",
        r"algorithm\s+to\s+",
        r"write\s+code",
        r"write\s+an?\s+algorithm",
    ]
    return any(re.search(p, s) for p in patterns)


def detect_language(s: str) -> str:
    s = (s or '').lower()
    # Heuristics: C, Java, Python
    if re.search(r"#include\s*<|scanf|printf|\bptr\b|\*\s*\w|->", s):
        return "c"
    if re.search(r"public\s+class|public\s+static\s+void\s+main|System\.out|Scanner\s*\(", s):
        return "java"
    if re.search(r"def\s+\w+\(|print\(|input\(|list\(|dict\(|len\(", s):
        return "python"
    # Fallback default
    return "python"


def starter_code_for(language: str) -> str:
    lang = (language or 'python').lower()
    if lang == 'c':
        return """#include <stdio.h>\n\nint main() {\n    // TODO: write your solution\n    // Example: read input and print output\n    // int n; scanf("%d", &n);\n    // printf("%d\\n", n);\n    return 0;\n}\n"""
    if lang == 'java':
        return """import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // TODO: write your solution\n        // int n = sc.nextInt();\n        // System.out.println(n);\n    }\n}\n"""
    # python - provide clean starter with input() calls
    return """# TODO: write your solution\n# Example:\n# n = int(input())\n# print(n)\n"""


def sanitize_questions(raw_questions):
    """Post-process and validate questions returned by the LLM.
    - Drop empty/low-quality items
    - Normalize MCQs to have 4 distinct options and a valid answer letter
    - Ensure code questions have language and at least one test case
    """
    if not isinstance(raw_questions, list):
        return []

    sanitized = []

    def is_low_quality(text: str) -> bool:
        t = (text or '').strip()
        if len(t) < 15:
            return True
        # trivial/placeholder phrases
        bad = [
            'what is this', 'choose the correct', 'lorem ipsum', 'sample question',
            'as described above', 'select the right answer',
            'a concept related to', 'a technology used in', 'a method for', 'a tool for'
        ]
        return any(b in t.lower() for b in bad)
    
    def has_generic_options(options_list) -> bool:
        """Check if options are generic placeholders"""
        if not isinstance(options_list, list):
            return False
        generic_patterns = [
            r'a concept related to',
            r'a technology used in',
            r'a method for',
            r'a tool for',
            r'option \d+',
            r'answer \d+'
        ]
        for opt in options_list:
            opt_str = str(opt).lower()
            if any(re.search(pattern, opt_str) for pattern in generic_patterns):
                return True
        return False

    for q in raw_questions:
        if not isinstance(q, dict):
            continue
        qtype = (q.get('type') or 'mcq').lower()
        question_text = q.get('question') or ''
        if is_low_quality(question_text):
            continue

        if qtype == 'code':
            lang = detect_language(question_text + ' ' + (q.get('language') or ''))
            q['type'] = 'code'
            q['language'] = lang
            
            # Clean up and validate coding question text
            # Remove references to document/content that make it not standalone
            question_text_clean = question_text.strip()
            
            # Check if question is too long (likely contains full document)
            max_question_length = 500
            if len(question_text_clean) > max_question_length:
                print(f"⚠️ Coding question too long ({len(question_text_clean)} chars), truncating", file=sys.stderr)
                # Try to extract just the problem statement
                # Look for sentence boundaries
                truncated = question_text_clean[:max_question_length]
                last_period = max(truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'))
                if last_period > max_question_length * 0.7:
                    question_text_clean = truncated[:last_period + 1]
                else:
                    question_text_clean = truncated.rstrip() + "..."
            
            # Remove phrases that indicate it references external content
            bad_prefixes = [
                'based on the provided content',
                'from the document above',
                'according to the content',
                'as described in the document',
                'implement a program that accomplishes the following based on',
                'write a program based on the provided'
            ]
            
            question_lower = question_text_clean.lower()
            for prefix in bad_prefixes:
                if question_lower.startswith(prefix):
                    # Try to extract the actual task after the prefix
                    remaining = question_text_clean[len(prefix):].strip()
                    if len(remaining) > 30:
                        question_text_clean = remaining
                    break
            
            # Ensure it's a standalone problem statement
            if not question_text_clean.strip().endswith(('.', '!', '?')):
                question_text_clean = question_text_clean.strip() + "."
            
            # Final length check - if still too long, truncate more aggressively
            if len(question_text_clean) > 400:
                # Find first sentence that contains task keywords
                sentences = re.split(r'[.!?]\s+', question_text_clean)
                for sent in sentences[:5]:  # Check first 5 sentences
                    if any(kw in sent.lower() for kw in ['write', 'implement', 'create', 'calculate', 'find', 'return', 'print']):
                        question_text_clean = sent.strip()
                        if not question_text_clean.endswith(('.', '!', '?')):
                            question_text_clean += "."
                        break
                
                # If still too long, just take first 350 chars at sentence boundary
                if len(question_text_clean) > 400:
                    truncated = question_text_clean[:350]
                    last_period = max(truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'))
                    if last_period > 250:
                        question_text_clean = truncated[:last_period + 1]
                    else:
                        question_text_clean = truncated.rstrip() + "..."
            
            q['question'] = question_text_clean
            
            if not q.get('starterCode'):
                q['starterCode'] = starter_code_for(lang)
            tcs = q.get('testCases')
            if not isinstance(tcs, list) or len(tcs) == 0:
                q['testCases'] = [{ 'stdin': '1\n', 'stdout': '1\n' }]
            sanitized.append(q)
            continue

        # MCQ normalization
        options = q.get('options')
        if not isinstance(options, list):
            # Attempt to split string into options
            if isinstance(options, str):
                options = [o.strip() for o in options.split(',') if o.strip()]
            else:
                options = []
        # Ensure 4 options (pad by simple variants if needed)
        options = [o for o in options if o]
        
        # Filter out generic placeholder options
        if has_generic_options(options):
            print(f"⚠️ Skipping question with generic options: {question_text[:50]}...", file=sys.stderr)
            continue
        
        # De-duplicate while preserving order
        seen = set()
        dedup = []
        for o in options:
            key = o.strip().lower()
            if key not in seen:
                seen.add(key)
                dedup.append(o)
        options = dedup[:4]
        
        # If we don't have enough meaningful options, skip this question
        if len(options) < 4:
            print(f"⚠️ Skipping question with insufficient options: {question_text[:50]}...", file=sys.stderr)
            continue

        answer_letter = (q.get('answer') or q.get('correctAnswer') or '').strip().upper()
        if answer_letter not in ['A', 'B', 'C', 'D']:
            # Default to A if invalid
            answer_letter = 'A'
        q['type'] = 'mcq'
        q['options'] = options
        q['answer'] = answer_letter
        sanitized.append(q)

    # Limit to a reasonable number
    return sanitized[:12]


def generate_questions_from_text(text):
    try:
        if not text or len(text.strip()) == 0:
            raise ValueError("No text content provided")

        # Sanitize input text: remove non-printable and problematic characters
        text = re.sub(r'[^\x20-\x7E\n\r]', '', text)

        # Truncate input text to avoid exceeding API limits
        max_length = 4000
        if len(text) > max_length:
            print(f"⚠️ Input text too long ({len(text)} chars), truncating to {max_length} chars", file=sys.stderr)
            text = text[:max_length]
        print(f"📄 Using input text length: {len(text)} characters", file=sys.stderr)
        print("🔍 Preview of input:\n", text[:300], "...\n", file=sys.stderr)

        # Try Mistral API first (mixed classification: code vs theory→MCQ)
        try:
            # Split into smaller topical blocks to encourage mixed output
            blocks = [blk.strip() for blk in re.split(r"\n{2,}", text) if blk.strip()]
            trimmed_blocks = blocks[:10] if len(blocks) > 10 else blocks
            joined_blocks = "\n\n".join(trimmed_blocks)

            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a quiz generator and classifier. Respond ONLY with a single JSON array. "
                        "You must classify parts of the provided content as either CODING or THEORY and generate a mixed quiz: "
                        "- For THEORY: generate 1-2 high-quality MCQs per topic chunk.\n"
                        "- For CODING: generate a code question with detailed problem statement, language, starter code, and 1-3 test cases.\n\n"
                        "For MCQ questions:\n"
                        "{\n  \"question\": \"...\",\n  \"options\": [\"Option A text\", \"Option B text\", \"Option C text\", \"Option D text\"],\n  \"answer\": \"A\",\n  \"type\": \"mcq\"\n}\n\n"
                        "CRITICAL REQUIREMENTS FOR MCQ OPTIONS:\n"
                        "- Each option must be a SPECIFIC, MEANINGFUL answer related to the question topic\n"
                        "- DO NOT use generic placeholders like 'A concept related to X', 'A technology used in X', 'A method for X', or 'A tool for X'\n"
                        "- Options should contain REAL, CONCRETE information from the content\n"
                        "- At least one option must be clearly correct based on the actual content\n"
                        "- Wrong options should be plausible but incorrect alternatives\n"
                        "- Example GOOD question: {\"question\": \"What is Big Data?\", \"options\": [\"Large volumes of structured and unstructured data\", \"Small datasets under 1MB\", \"Only numeric data\", \"Data stored in a single file\"], \"answer\": \"A\", \"type\": \"mcq\"}\n"
                        "- Example BAD question (DO NOT CREATE): {\"question\": \"What is Big Data?\", \"options\": [\"A concept related to big data\", \"A technology used in big data\", \"A method for big data\", \"A tool for big data\"], ...}\n\n"
                        "For code questions:\n"
                        "{\n  \"question\": \"<CONCISE PROBLEM STATEMENT (100-300 words max) with what to implement, input/output format, and 1-2 examples>\",\n  \"type\": \"code\",\n  \"language\": \"python|c|java\",\n  \"starterCode\": \"<short starter code>\",\n  \"testCases\": [ { \"stdin\": \"input\", \"stdout\": \"expected\" } ]\n}\n\n"
                        "CRITICAL for coding questions:\n"
                        "- Keep 'question' field CONCISE (under 300 words, ideally 100-200 words)\n"
                        "- DO NOT include the entire document content in the question field\n"
                        "- DO NOT say 'based on the provided content' or 'from the document above'\n"
                        "- Write a STANDALONE problem statement that makes sense on its own\n"
                        "- Format: Brief description (2-3 sentences) + Input format + Output format + 1-2 examples\n"
                        "- Example GOOD: \"Write a function to calculate factorial of n. Input: integer n (0<=n<=10). Output: factorial of n. Example: Input 5, Output 120.\"\n"
                        "- Example BAD (DO NOT DO): \"Implement a program that accomplishes the following based on the provided content: [entire document here]\"\n"
                        "Choose language heuristically: use C if #include/scanf/printf, Java if public static void main/System.out, otherwise Python. "
                        "Generate exactly 10 questions total; include MCQs from theory parts and code questions from coding parts."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        "Classify and generate a mixed quiz from the following content blocks. "
                        "For each block: If it describes implementation/programming tasks, produce a code question; otherwise produce MCQs.\n\n"
                        f"CONTENT BLOCKS:\n\n{joined_blocks}"
                    )
                }
            ]

            payload = {
                "model": "mistral-medium",
                "messages": messages,
                "temperature": 0.5,
                "max_tokens": 3000,  # Increased to support 10 questions
                "top_p": 0.9
            }
            print("Payload being sent:", json.dumps(payload, indent=2), file=sys.stderr)
            response = requests.post(API_URL, headers=headers, json=payload)

            print(f"📬 Mistral API response status: {response.status_code}", file=sys.stderr)

            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                print("✅ Raw response received", file=sys.stderr)

                try:
                    # Try to parse as JSON directly
                    quiz_json = json.loads(content)
                    print("✅ JSON format validated", file=sys.stderr)
                    quiz_json = sanitize_questions(quiz_json)
                    return json.dumps(quiz_json)
                except json.JSONDecodeError as e:
                    # Try to extract JSON array from the content using regex
                    print(f"⚠️ Raw content not valid JSON, attempting to extract JSON array. Raw content:\n{content}", file=sys.stderr)
                    match = re.search(r'(\[.*\])', content, re.DOTALL)
                    if match:
                        try:
                            quiz_json = json.loads(match.group(1))
                            print("✅ Extracted JSON array from response", file=sys.stderr)
                            quiz_json = sanitize_questions(quiz_json)
                            return json.dumps(quiz_json)
                        except Exception as e2:
                            print(f"❌ Still invalid after extraction: {e2}", file=sys.stderr)
                    raise ValueError(f"Invalid JSON returned by Mistral: {e}")

            else:
                print("❌ API Error:", response.text, file=sys.stderr)
                if response.status_code == 429:
                    print("⚠️ API rate limit exceeded, using fallback quiz generator", file=sys.stderr)
                    raise Exception("API rate limit exceeded")
                else:
                    raise Exception(f"Failed to generate quiz. Status code: {response.status_code}")
                    
        except Exception as api_error:
            print(f"⚠️ Mistral API failed: {api_error}, using fallback generator", file=sys.stderr)
            # Fallback to simple quiz generation
            return generate_fallback_quiz(text)
            
    except Exception as e:
        print(f"❌ Exception in quiz generation: {e}", file=sys.stderr)
        return f"Error: {str(e)}"

def generate_fallback_quiz(text):
    """Generate a simple quiz when API is not available - improved to avoid generic answers"""
    print("🔄 Using fallback quiz generator", file=sys.stderr)
    print("⚠️ WARNING: Fallback generator may produce lower quality questions. Consider checking Mistral API configuration.", file=sys.stderr)
    
    if not text or len(text.strip()) < 50:
        print("❌ Error: Insufficient content in PDF to generate quiz", file=sys.stderr)
        raise ValueError("Insufficient content in PDF. Please ensure the PDF contains readable text (at least 50 characters).")
    
    questions = []

    # Try to extract meaningful content from text - be more lenient with sentence length
    sentences = re.split(r'[.!?]\s+', text)
    meaningful_sentences = [s.strip() for s in sentences if len(s.strip()) > 20 and len(s.strip()) < 300]
    
    # If we don't have enough sentences, try splitting by newlines
    if len(meaningful_sentences) < 3:
        lines = [l.strip() for l in text.split('\n') if len(l.strip()) > 20]
        meaningful_sentences.extend(lines[:10])
        meaningful_sentences = list(set(meaningful_sentences))  # Remove duplicates
    
    # Extract key terms - be more lenient, include single occurrence terms too
    words = re.findall(r'\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*\b', text)
    term_counts = {}
    stop_words = {'this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'were', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'could', 'other', 'about', 'many', 'then', 'them', 'these', 'some', 'what', 'when', 'where', 'here', 'very', 'just', 'into', 'only', 'over', 'after', 'bene', 'under', 'again', 'further', 'should', 'shall', 'might', 'must', 'cannot', 'cannot'}
    
    for word in words:
        term_lower = word.lower()
        if term_lower not in stop_words and len(word) > 3:
            term_counts[word] = term_counts.get(word, 0) + 1
    
    # Get significant terms - include terms that appear at least once if we don't have enough
    # Get more terms to ensure we can generate 10 questions
    significant_terms = sorted([(term, count) for term, count in term_counts.items() if count >= 1], 
                              key=lambda x: x[1], reverse=True)[:15]
    
    # If text looks like coding prompt, create a code question first
    if is_code_prompt(text):
        lang = detect_language(text)
        coding_prompt = None
        
        lines = text.split('\n')
        # Look for concise programming task descriptions
        for line in lines:
            line_clean = line.strip()
            if is_code_prompt(line) and 20 < len(line_clean) < 300:
                # Ensure it's a proper problem statement, not full document
                if not any(phrase in line_clean.lower() for phrase in [
                    'based on the provided', 'from the content above', 'according to the document',
                    'the following content', 'as described in'
                ]):
                    coding_prompt = line_clean
                    break
        
        # If not found, try to extract a concise problem from meaningful lines
        if not coding_prompt:
            for line in lines[:30]:  # Check first 30 lines
                line_clean = line.strip()
                if (30 < len(line_clean) < 200 and 
                    any(kw in line_clean.lower() for kw in ['calculate', 'find', 'determine', 'return', 'print', 'output', 'input', 'function', 'program', 'algorithm'])):
                    # Clean up common prefixes that indicate it's not a standalone problem
                    if not any(prefix in line_clean.lower()[:50] for prefix in [
                        'according to', 'based on', 'from the', 'the document', 'the content'
                    ]):
                        coding_prompt = line_clean
                        break
        
        # Format as proper problem statement if found
        if coding_prompt:
            # Ensure it's concise and well-formatted
            if len(coding_prompt) > 250:
                # Truncate at sentence boundary
                truncated = coding_prompt[:250]
                last_period = max(truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'))
                if last_period > 150:
                    coding_prompt = truncated[:last_period + 1]
                else:
                    coding_prompt = truncated.rstrip() + "..."
            
            # Ensure it ends properly
            if not coding_prompt.strip().endswith(('.', '!', '?')):
                coding_prompt = coding_prompt.strip() + "."
            
            questions.append({
                "question": coding_prompt,
                "type": "code",
                "language": lang,
                "starterCode": starter_code_for(lang),
                "testCases": [
                    {"stdin": "1\n", "stdout": "1\n"}
                ]
            })
    
    # Track used sentences/options across all questions to avoid duplicates
    used_sentences = set()
    
    # Generate questions from significant terms found in the text
    # Use actual content sentences as options
    processed_terms = 0
    for term, count in significant_terms:
        if processed_terms >= 10:  # Limit to 10 questions
            break
            
        term_lower = term.lower()
        # Find sentences containing this term
        context_sentences = [s for s in meaningful_sentences if term_lower in s.lower() and s not in used_sentences]
        
        if context_sentences:
            # Pick a context sentence that hasn't been used yet
            context = None
            for ctx in context_sentences:
                if ctx not in used_sentences:
                    context = ctx
                    break
            
            if not context:
                continue  # Skip if all context sentences are used
            
            # Create a question
            question_text = f"What does the content say about {term}?"
            
            # Create correct option from context - normalize to avoid duplicates
            correct_option_raw = context[:120].strip()
            if len(context) > 120:
                correct_option_raw += "..."
            
            # Normalize the option for comparison (remove extra spaces, lowercase first 50 chars)
            correct_option_normalized = correct_option_raw.lower().strip()[:50]
            
            # Mark this sentence as used
            used_sentences.add(context)
            
            # Find other sentences for distractors - avoid already used ones
            distractors = []
            other_sentences = [s for s in meaningful_sentences 
                             if s != context 
                             and s not in used_sentences
                             and term_lower not in s.lower()]
            
            # Shuffle to get variety
            random.shuffle(other_sentences)
            
            # Use up to 3 other sentences as distractors, ensuring uniqueness
            for other_sent in other_sentences:
                if len(distractors) >= 3:
                    break
                    
                distractor_raw = other_sent[:120].strip()
                if len(other_sent) > 120:
                    distractor_raw += "..."
                
                # Normalize for comparison
                distractor_normalized = distractor_raw.lower().strip()[:50]
                
                # Check if this distractor is unique (not same as correct, not same as other distractors)
                is_unique = (distractor_normalized != correct_option_normalized and
                           distractor_normalized not in [d.lower().strip()[:50] for d in distractors])
                
                if distractor_raw and is_unique:
                    distractors.append(distractor_raw)
                    used_sentences.add(other_sent)  # Mark as used to avoid reuse in other questions
            
            # If we still don't have enough distractors, try creating variations
            if len(distractors) < 3:
                # Get more sentences that aren't used
                remaining_sentences = [s for s in meaningful_sentences 
                                     if s not in used_sentences 
                                     and s != context
                                     and s[:120].strip().lower()[:50] not in [d.lower().strip()[:50] for d in distractors]]
                
                random.shuffle(remaining_sentences)
                
                for other_sent in remaining_sentences:
                    if len(distractors) >= 3:
                        break
                    
                    distractor_raw = other_sent[:120].strip()
                    if len(other_sent) > 120:
                        distractor_raw += "..."
                    
                    distractor_normalized = distractor_raw.lower().strip()[:50]
                    is_unique = (distractor_normalized != correct_option_normalized and
                               distractor_normalized not in [d.lower().strip()[:50] for d in distractors])
                    
                    if distractor_raw and is_unique:
                        distractors.append(distractor_raw)
                        used_sentences.add(other_sent)
            
            # Only add if we have at least 1 distractor (2 total options minimum)
            if len(distractors) >= 1:
                # If we still don't have 3 distractors, create unique generic ones
                generic_counter = 1
                while len(distractors) < 3:
                    distractor = f"A different point discussed in the document"
                    distractor_normalized = distractor.lower().strip()[:50]
                    if (distractor_normalized not in [d.lower().strip()[:50] for d in distractors] and
                        distractor_normalized != correct_option_normalized):
                        distractors.append(distractor)
                    else:
                        generic_counter += 1
                        if generic_counter > 5:  # Avoid infinite loop
                            break
                
                # Ensure we have exactly 4 options
                while len(distractors) < 3:
                    # Add placeholder that will be unique
                    distractor = f"Additional information from section {len(distractors) + 1}"
                    distractors.append(distractor)
                
                options = [correct_option_raw] + distractors[:3]
                
                # Shuffle options but remember correct answer index
                correct_idx = 0
                indices = list(range(4))
                random.shuffle(indices)
                shuffled_options = [options[i] for i in indices]
                correct_idx = indices.index(0)
                answer_letter = chr(65 + correct_idx)  # A, B, C, or D
                
                question = {
                    "question": question_text,
                    "options": shuffled_options,
                    "answer": answer_letter,
                    "type": "mcq"
                }
                questions.append(question)
                processed_terms += 1
    
    # If we still don't have enough questions, try creating simple comprehension questions
    # Use sentences that haven't been used yet
    # Continue generating until we have at least 10 questions (or can't generate more)
    questions_added_in_iteration = True
    while len(questions) < 10 and len(meaningful_sentences) >= 3 and questions_added_in_iteration:
        questions_before = len(questions)
        unused_sentences = [s for s in meaningful_sentences if s not in used_sentences]
        if len(unused_sentences) == 0:
            break  # No more sentences to use
        random.shuffle(unused_sentences)
        
        for sent in unused_sentences:
            if len(questions) >= 10:
                break
            if len(sent) > 40 and sent not in used_sentences:
                # Create a simple comprehension question
                question_text = f"According to the document, which of the following is mentioned?"
                
                correct_option_raw = sent[:100].strip()
                if len(sent) > 100:
                    correct_option_raw += "..."
                
                correct_option_normalized = correct_option_raw.lower().strip()[:50]
                used_sentences.add(sent)
                
                # Use other unused sentences as distractors
                distractors = []
                remaining_unused = [s for s in unused_sentences if s != sent and s not in used_sentences]
                random.shuffle(remaining_unused)
                
                for other_sent in remaining_unused:
                    if len(distractors) >= 3:
                        break
                    if len(other_sent) > 20:
                        distractor_raw = other_sent[:100].strip()
                        if len(other_sent) > 100:
                            distractor_raw += "..."
                        
                        distractor_normalized = distractor_raw.lower().strip()[:50]
                        if (distractor_raw and 
                            distractor_normalized != correct_option_normalized and
                            distractor_normalized not in [d.lower().strip()[:50] for d in distractors]):
                            distractors.append(distractor_raw)
                            used_sentences.add(other_sent)
                
                # Fill remaining slots with unique placeholders
                while len(distractors) < 3:
                    placeholder = f"Content from a different part of the document"
                    placeholder_normalized = placeholder.lower().strip()[:50]
                    if (placeholder_normalized not in [d.lower().strip()[:50] for d in distractors] and
                        placeholder_normalized != correct_option_normalized):
                        distractors.append(placeholder)
                    else:
                        break
                
                if len(distractors) >= 1:
                    options = [correct_option_raw] + distractors[:3]
                    
                    # Shuffle options
                    correct_idx = 0
                    indices = list(range(4))
                    random.shuffle(indices)
                    shuffled_options = [options[i] for i in indices]
                    correct_idx = indices.index(0)
                    answer_letter = chr(65 + correct_idx)
                    
                    question = {
                        "question": question_text,
                        "options": shuffled_options,
                        "answer": answer_letter,
                        "type": "mcq"
                    }
                    questions.append(question)
                    # Break from inner loop if we've reached 10 questions
                    if len(questions) >= 10:
                        break
        
        # Check if we added any questions in this iteration
        questions_added_in_iteration = (len(questions) > questions_before)
        if not questions_added_in_iteration:
            break  # No questions were added, stop trying
    
    # Final check - if we still have no questions, raise an error
    if len(questions) == 0:
        print("❌ Error: Could not extract enough content from PDF to generate quiz", file=sys.stderr)
        raise ValueError("Unable to generate quiz from PDF content. The PDF may be empty, contain only images, or have insufficient text. Please ensure the PDF contains readable text content.")
    
    print(f"✅ Generated {len(questions)} fallback questions from content analysis", file=sys.stderr)
    return json.dumps(questions)

if __name__ == "__main__":
    try:
        print("📥 Reading input from stdin...", file=sys.stderr)
        notes_content = sys.stdin.read().strip()

        if not notes_content:
            print("❗ Error: No input provided", file=sys.stderr)
            sys.exit(1)

        print("⚙️ Generating quiz from content...", file=sys.stderr)
        quiz = generate_questions_from_text(notes_content)

        if quiz.startswith("Error:"):
            print(quiz, file=sys.stderr)
            sys.exit(1)

        print(quiz)
    except ValueError as ve:
        # ValueError from fallback generator - return clear error message
        error_msg = f"Error: {str(ve)}"
        print(error_msg, file=sys.stderr)
        print(error_msg)  # Also output to stdout so backend can catch it
        sys.exit(1)
    except Exception as e:
        print(f"🚨 Main error: {e}", file=sys.stderr)
        print(f"Error: Quiz generation failed: {str(e)}")  # Output to stdout too
        sys.exit(1)
