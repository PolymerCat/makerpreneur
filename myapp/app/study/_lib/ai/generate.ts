import { llm } from "./gemini";
import { prompts } from "./prompts";
import { retrieve, retrieveAdvanced } from "./retrieve";

async function chat(
  chunks: string[],
  question: string,
  chatHistory: string,
  language: string
): Promise<string> {
  var prompt = prompts.chatPrompt(chunks, question, chatHistory, language);
  return await llm.generate(prompt, 0.3, 2000, "chat");
}

async function summarize(
  fullText: string,
  mode: string,
  language: string
): Promise<string> {
  var prompt = prompts.summarizePrompt(fullText, mode, language);
  return await llm.generate(prompt, 0.2, 2000, "summarize");
}

async function makeFlashcards(
  fullText: string,
  language: string,
  cardCount: number
): Promise<{ front: string; back: string }[]> {
  var prompt = prompts.flashcardsPrompt(fullText, language, cardCount);
  var result = await llm.generateJson(prompt, 0.4, 4000, "flashcards");
  return result;
}

async function makeQuiz(
  fullText: string,
  language: string,
  questionCount: number
): Promise<{ kind: string; prompt: string; options: string[] | null; answer: string; rubric: string | null }[]> {
  var prompt = prompts.quizPrompt(fullText, language, questionCount);
  var result = await llm.generateJson(prompt, 0.4, 16000, "quiz");
  return result.questions;
}

async function gradeEssay(
  question: string,
  rubric: string,
  studentAnswer: string
): Promise<{ score: number; feedback: string }> {
  var prompt = prompts.essayGradePrompt(question, rubric, studentAnswer);
  return await llm.generateJson(prompt, 0.1, 1000, "essay_grade");
}

async function translateText(
  fullText: string,
  targetLanguage: string
): Promise<string> {
  var prompt = prompts.translatePrompt(fullText, targetLanguage);
  var result = await llm.generateJson(prompt, 0.1, 4000, "translate");
  return result.translatedText || "";
}

async function predictQuestions(
  styleData: string,
  courseName: string,
  language: string
): Promise<{ question: string; modelAnswer: string; marks: number; probability: string }[]> {
  var prompt = prompts.predictorPrompt(styleData, courseName, language);
  return await llm.generateJson(prompt, 0.5, 4000, "predict");
}

async function makeStudyPath(
  courseName: string,
  examDate: string,
  goals: string,
  language: string
): Promise<{ days: { dayNumber: number; date: string; topic: string; tasks: string[] }[] }> {
  var prompt = prompts.studyPathPrompt(courseName, examDate, goals, language);
  return await llm.generateJson(prompt, 0.4, 4000, "study_path");
}

export {
  chat,
  summarize,
  makeFlashcards,
  makeQuiz,
  gradeEssay,
  translateText,
  predictQuestions,
  makeStudyPath
};
