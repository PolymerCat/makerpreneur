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
    langInstruction = "Create quiz questions in Bahasa Melayu.";
  } else {
    langInstruction = "Create quiz questions in English.";
  }
  return "Create " + questionCount + " quiz questions from the following text.\n" +
    langInstruction + "\n" +
    "Include a mix of multiple-choice (mcq), true-false (tf), and essay questions.\n" +
    "Return JSON: { questions: [{ kind: 'mcq'|'tf'|'essay', prompt: string, options: string[]|null, answer: string, rubric: string|null }] }\n" +
    "For mcq, provide 4 options. For tf, provide options: ['True', 'False']. For essay, options is null and rubric is the marking guide.\n\nTEXT:\n" + fullText;
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
  styleData: string,
  courseName: string,
  language: string
): string {
  var langInstruction = "";
  if (language === "ms") {
    langInstruction = "Generate questions in Bahasa Melayu.";
  } else {
    langInstruction = "Generate questions in English.";
  }
  return "You are an exam predictor for " + courseName + ".\n" +
    "Based on the following analysis of past exam papers, predict likely exam questions.\n" +
    langInstruction + "\n" +
    "Topic frequencies and style guide:\n" + styleData + "\n\n" +
    "Return a JSON array of { question: string, modelAnswer: string, marks: number, probability: 'high'|'medium'|'low' }";
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
