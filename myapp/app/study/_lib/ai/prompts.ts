import { stripCitations } from "./citations";

function chatPrompt(
  chunks: string[],
  question: string,
  chatHistory: string,
  language: string
): string {
  var contextText = "";
  for (var i = 0; i < chunks.length; i++) {
    contextText = contextText + "[P." + i + "] " + stripCitations(chunks[i]) + "\n\n";
  }
  var langInstruction = "";
  if (language === "ms") {
    langInstruction = "Answer in Bahasa Melayu.";
  } else {
    langInstruction = "Answer in English.";
  }
  return "You are a helpful study assistant. Use ONLY the following context to answer the question. If you cannot answer from the context, say so.\n\nCONTEXT:\n" +
    contextText + "\n" +
    "CHAT HISTORY:\n" + chatHistory + "\n\n" +
    "QUESTION: " + question + "\n\n" +
    langInstruction + "\nAnswer ONLY using context.";
}

function summarizePrompt(fullText: string, mode: string, language: string): string {
  var modeInstruction = "";
  if (mode === "short") {
    modeInstruction = "Write a short summary with 3-5 bullet points.";
  } else if (mode === "detailed") {
    modeInstruction = "Write a detailed summary covering all key concepts and main points.";
  } else {
    modeInstruction = "Write a study guide with headings, key terms, and exam tips.";
  }
  var langInstruction = "";
  if (language === "ms") {
    langInstruction = "Write in Bahasa Melayu.";
  } else {
    langInstruction = "Write in English.";
  }
  return "Summarize the following text.\n" + modeInstruction + "\n" + langInstruction + "\n" +
    "Do not include bracketed citation numbers or references like [1] or [7].\n\nTEXT:\n" + stripCitations(fullText);
}

function flashcardsPrompt(fullText: string, language: string, cardCount: number): string {
  var langInstruction = "";
  if (language === "ms") {
    langInstruction = "Create flashcards in Bahasa Melayu.";
  } else {
    langInstruction = "Create flashcards in English.";
  }
  return "Create " + cardCount + " flashcards from the following text.\n" +
    langInstruction + "\n" +
    "Do not include bracketed citation numbers or references like [1] or [7].\n" +
    "Return a JSON array of objects with keys 'front' and 'back'.\n\nTEXT:\n" + stripCitations(fullText);
}

function quizPrompt(fullText: string, language: string, questionCount: number): string {
  var langInstruction = "";
  if (language === "ms") {
    langInstruction = "Create quiz questions in Bahasa Melayu. Write all prompt texts, options, answers, and explanations in Bahasa Melayu.";
  } else {
    langInstruction = "Create quiz questions in English. Write all prompt texts, options, answers, and explanations in English.";
  }
  return "Create " + questionCount + " quiz questions based strictly on the provided text.\n" +
    langInstruction + "\n" +
    "Do not include bracketed citation numbers or references like [1] or [7].\n" +
    "Include a mix of multiple-choice (mcq), true-false (tf), and essay questions.\n" +
    "Return JSON: {\n" +
    "  \"questions\": [{\n" +
    "    \"kind\": \"mcq\" | \"tf\" | \"essay\",\n" +
    "    \"prompt\": string,\n" +
    "    \"options\": string[] | null,\n" +
    "    \"answer\": string,\n" +
    "    \"explanations\": Record<string, string> | null,\n" +
    "    \"rubric\": string | null\n" +
    "  }]\n" +
    "}\n" +
    "REQUIREMENTS FOR EXPLANATIONS:\n" +
    "- For mcq: 'options' has 4 choices. 'answer' must be the exact string of the correct choice. 'explanations' MUST be an object where EVERY key is the EXACT string from 'options', and the value is a 1-sentence concise explanation based on the source text explaining why that choice is correct or why it is incorrect.\n" +
    "- For tf: 'options' is ['True', 'False']. 'answer' is 'True' or 'False'. 'explanations' MUST be an object with keys 'True' and 'False', each mapped to a 1-sentence concise explanation based on the source text.\n" +
    "- For essay: options is null, explanations is null, rubric is the grading key.\n\nTEXT:\n" + fullText;
}

function essayGradePrompt(question: string, rubric: string, studentAnswer: string): string {
  return "Grade the following student answer.\n" +
    "Question: " + question + "\n" +
    "Rubric: " + rubric + "\n" +
    "Student answer: " + studentAnswer + "\n\n" +
    "Return JSON: { score: number (0-100), feedback: string }";
}

function translatePrompt(fullText: string, targetLanguage: string): string {
  return "Translate the following text to " + targetLanguage + ".\n" +
    "Return JSON: { translatedText: string }\n\nTEXT:\n" + fullText;
}

function predictorPrompt(
  materialContent: string,
  courseName: string,
  language: string
): string {
  var langInstruction = language === "ms" ? "Generate questions in Bahasa Melayu." : "Generate questions in English.";
  var textSnippet = materialContent.length > 16000 ? materialContent.substring(0, 16000) + "\n...[truncated]" : materialContent;

  return "You are an expert exam question predictor for the course: " + courseName + ".\n" +
    "Analyze the following source exam papers/study material content carefully:\n\n" +
    "--- MATERIAL START ---\n" + stripCitations(textSnippet) + "\n--- MATERIAL END ---\n\n" +
    "Based strictly on the course material above, identify the core technical topics, patterns, and question styles. " +
    "Predict 4 to 6 highly probable exam questions (with comprehensive model answers and mark allocations) that test key concepts from this material.\n" +
    "Do not include bracketed citation numbers or references like [1] or [7].\n" +
    langInstruction + "\n" +
    "\"topic\" must be a short overarching concept label (3-6 words, e.g. \"Transmission Lines & Wave Reflection\") naming the general concept the question tests, never a restatement of the question itself.\n" +
    "Return JSON array: [{ \"question\": string, \"modelAnswer\": string, \"marks\": number, \"probability\": \"high\"|\"medium\"|\"low\", \"topic\": string }]";
}

function topicNamePrompt(
  questions: string[],
  courseName: string
): string {
  var list = "";
  for (var i = 0; i < questions.length; i++) {
    list = list + (i + 1) + ". " + questions[i] + "\n";
  }
  return "You are a course analyst for: " + courseName + ".\n" +
    "For EACH exam question below, give ONE short overarching concept label (3-6 words) naming the general concept it tests (e.g. \"Transmission Lines & Wave Reflection\").\n" +
    "Labels must be general concepts, never restatements of the question. Questions testing the same concept MUST share the exact same label.\n" +
    "Return JSON: { \"names\": [string] } with exactly one label per question, in the same order.\n\n" +
    "QUESTIONS:\n" + list;
}

function pastQuestionsPrompt(
  topicNames: string[],
  courseName: string,
  papersText: string
): string {
  var pText = papersText.length > 40000 ? papersText.substring(0, 40000) + "\n...[truncated]" : papersText;
  var list = "";
  for (var i = 0; i < topicNames.length; i++) {
    list = list + (i + 1) + ". " + topicNames[i] + "\n";
  }
  return "You are a course analyst for: " + courseName + ".\n" +
    "Below are verbatim past-year exam papers.\n\n" +
    "=== PAST PAPERS ===\n" + pText + "\n\n" +
    "For EACH concept below, find every question in the past papers that tests that concept and quote each one EXACTLY verbatim, word for word, " +
    "including part labels like (a)/(b) and any marks. Never paraphrase or summarize.\n" +
    "The papers are bilingual (English and Bahasa Malaysia). Include ONLY the English version of each question. " +
    "If a question is written only in Bahasa Malaysia, translate it into English (mark the translation with the prefix \"[Translated] \").\n" +
    "If a concept has no matching question, return an empty array for it.\n\n" +
    "CONCEPTS:\n" + list + "\n" +
    "Return JSON: { \"topics\": [{ \"name\": string, \"questions\": [string] }] } with one entry per concept, in the same order.";
}

function studyPathPrompt(
  courseName: string,
  examDate: string,
  goals: string,
  language: string
): string {
  var langInstruction = "";
  if (language === "ms") {
    langInstruction = "Generate the plan in Bahasa Melayu.";
  } else {
    langInstruction = "Generate the plan in English.";
  }
  return "Create a study plan for " + courseName + ".\n" +
    "Exam date: " + examDate + "\n" +
    "Goals: " + goals + "\n" +
    langInstruction + "\n" +
    "Return JSON: { days: [{ dayNumber: number, date: string, topic: string, tasks: string[] }] }";
}

function generateExamPaperJsonPrompt(
  syllabusText: string,
  pastPapersText: string,
  courseCode: string,
  title: string,
  numQuestions: number
): string {
  var pText = pastPapersText.length > 35000 ? pastPapersText.substring(0, 35000) + "\n...[truncated]" : pastPapersText;
  var sText = syllabusText.length > 25000 ? syllabusText.substring(0, 25000) + "\n...[truncated]" : syllabusText;
  
  return "You are an expert university professor and examiner for " + courseCode + " - " + title + ".\n" +
    "Generate a bilingual (English and Bahasa Malaysia) exam paper JSON that follows the USM 'SULIT' format.\n\n" +
    "=== PRIMARY DOMAIN & REFERENCE PAST PAPERS (SUBJECT SCOPE, DIFFICULTY & STRUCTURE) ===\n" + pText + "\n\n" +
    (sText ? ("=== COURSE REFERENCE MATERIAL ===\n" + sText + "\n\n") : "") +
    "CRITICAL REQUIREMENTS ON SUBJECT CORRELATION & SYLLABUS SCOPE (PREVENT CONTEXT CONTAMINATION):\n" +
    "1. Every question MUST test topics present in the reference past papers; never invent topics not covered by the materials.\n" +
    "2. If the reference text is empty, return {\"error\":\"no reference content\"} instead of generating.\n" +
    "3. If the Course Reference Material contains notes from unrelated subjects or topics not covered in the Reference Past Papers (context contamination), YOU MUST IGNORE THEM COMPLETELY.\n" +
    "4. Design new, rigorous university-level exam questions (with analytical reasoning, equations, scenarios, or diagrams where appropriate) that test the exact syllabus concepts seen in the Reference Past Papers.\n\n" +
    "FORMAT REQUIREMENTS:\n" +
    "1. Generate exactly " + numQuestions + " main questions.\n" +
    "2. Randomize the inclusion of sub-questions (`parts`: (a), (b), (c)) for each question to match the varying structural depth seen in the past papers (some questions should be single essays, some multi-part).\n" +
    "3. Total marks across all questions MUST sum to exactly 100.\n" +
    "4. All text fields must be bilingual: `text_en` (English) and `text_bm` (Bahasa Malaysia).\n" +
    "5. When including mathematical formulas, equations, subscripts, superscripts, or symbols in questions, you may use standard LaTeX syntax (e.g. $P_1$, $x^2$, \\alpha, \\frac{a}{b}, \\sum_{i=1}^n x_i) which will be automatically formatted for the PDF.\n" +
    "6. Output valid JSON matching this schema exactly:\n" +
    "{\n" +
    "  \"paper\": {\n" +
    "    \"course_code\": \"" + courseCode + "\",\n" +
    "    \"first_page_number\": 1,\n" +
    "    \"include_instructions\": true,\n" +
    "    \"instructions\": {\n" +
    "      \"num_questions_en\": \"FOUR (4)\",\n" +
    "      \"num_questions_bm\": \"EMPAT (4)\"\n" +
    "    }\n" +
    "  },\n" +
    "  \"questions\": [\n" +
    "    {\n" +
    "      \"number\": 1,\n" +
    "      \"text_en\": \"...\",\n" +
    "      \"text_bm\": \"...\",\n" +
    "      \"marks\": 25\n" +
    "    },\n" +
    "    {\n" +
    "      \"number\": 2,\n" +
    "      \"intro_en\": \"Answer the following questions.\",\n" +
    "      \"intro_bm\": \"Jawab soalan-soalan yang berikut.\",\n" +
    "      \"parts\": [\n" +
    "        {\"label\": \"a\", \"text_en\": \"...\", \"text_bm\": \"...\"},\n" +
    "        {\"label\": \"b\", \"text_en\": \"...\", \"text_bm\": \"...\"}\n" +
    "      ],\n" +
    "      \"marks\": 25\n" +
    "    }\n" +
    "  ]\n" +
    "}\n\n" +
    "Return ONLY valid JSON.";
}

export var prompts = {
  chatPrompt: chatPrompt,
  summarizePrompt: summarizePrompt,
  flashcardsPrompt: flashcardsPrompt,
  quizPrompt: quizPrompt,
  essayGradePrompt: essayGradePrompt,
  translatePrompt: translatePrompt,
  predictorPrompt: predictorPrompt,
  topicNamePrompt: topicNamePrompt,
  pastQuestionsPrompt: pastQuestionsPrompt,
  studyPathPrompt: studyPathPrompt,
  generateExamPaperJsonPrompt: generateExamPaperJsonPrompt
};
