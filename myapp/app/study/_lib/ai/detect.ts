import { llm } from "./gemini";

var MIN_YEAR = 2000;
var MAX_YEAR = 2030;

async function detectMetadata(
  firstPageText: string,
  fileName: string
): Promise<{ title: string; year: number; semester: string; category: string; courseCode: string }> {
  var detectPrompt = "Analyze this document's first page and metadata.\n" +
    "File name: " + fileName + "\n\n" +
    "First page content:\n" + firstPageText.substring(0, 1200) + "\n\n" +
    "Return JSON: { title: string, year: number, semester: string, category: 'regular'|'exam_paper', courseCode: string }";
  try {
    var resObj = await llm.generateJson(detectPrompt, 0.2, 1000, "detect");
    var result = resObj.value;
    return {
      title: result.title || fileName,
      year: (typeof result.year === "number" && result.year >= MIN_YEAR && result.year <= MAX_YEAR) ? result.year : new Date().getFullYear(),
      semester: result.semester ? String(result.semester) : "1",
      category: result.category || "regular",
      courseCode: result.courseCode || ""
    };
  } catch (err) {
    return {
      title: fileName,
      year: new Date().getFullYear(),
      semester: "1",
      category: "regular",
      courseCode: ""
    };
  }
}

export { detectMetadata };
