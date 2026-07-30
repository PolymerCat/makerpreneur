function chatPrompt(
  chunks: string[],
  question: string,
  chatHistory: string,
  language: string
): string {
  var contextText = "";
  for (var i = 0; i < chunks.length; i++) {
    contextText = contextText + "[P." + i + "] " + chunks[i] + "\n\n";
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
  return "Summarize the following text.\n" + modeInstruction + "\n" + langInstruction + "\n\nTEXT:\n" + fullText;
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
    "Return a JSON array of objects with keys 'front' and 'back'.\n\nTEXT:\n" + fullText;
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
    "--- MATERIAL START ---\n" + textSnippet + "\n--- MATERIAL END ---\n\n" +
    "Based strictly on the course material above, identify the core technical topics, patterns, and question styles. " +
    "Predict 4 to 6 highly probable exam questions (with comprehensive model answers and mark allocations) that test key concepts from this material.\n" +
    langInstruction + "\n" +
    "Return JSON array: [{ \"question\": string, \"modelAnswer\": string, \"marks\": number, \"probability\": \"high\"|\"medium\"|\"low\" }]";
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

export var prompts = {
  chatPrompt: chatPrompt,
  summarizePrompt: summarizePrompt,
  flashcardsPrompt: flashcardsPrompt,
  quizPrompt: quizPrompt,
  essayGradePrompt: essayGradePrompt,
  translatePrompt: translatePrompt,
  predictorPrompt: predictorPrompt,
  studyPathPrompt: studyPathPrompt
};
