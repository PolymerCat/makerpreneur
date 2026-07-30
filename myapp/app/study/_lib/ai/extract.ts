var DEFAULT_CHUNK_SIZE = 600;
var DEFAULT_OVERLAP = 60;

function extractPages(
  fileText: string,
  fileType: string,
  fileName: string
): { page: number; text: string }[] {
  if (fileType.includes("pdf")) {
    return extractFromPdf(fileText);
  }
  if (fileType.includes("wordprocessing") || fileName.endsWith(".docx")) {
    return extractFromDocx(fileText);
  }
  if (fileType.includes("presentation") || fileName.endsWith(".pptx")) {
    return extractFromPptx(fileText);
  }
  return extractFromPlainText(fileText);
}

function extractFromPdf(text: string): { page: number; text: string }[] {
  var pages = text.split("\f");
  var result: { page: number; text: string }[] = [];
  for (var i = 0; i < pages.length; i++) {
    var pageText = pages[i].trim();
    if (pageText.length > 0) {
      result.push({ page: i + 1, text: pageText });
    }
  }
  if (result.length === 0) {
    result.push({ page: 1, text: text });
  }
  return result;
}

function extractFromDocx(text: string): { page: number; text: string }[] {
  var paragraphs = text.split("\n");
  var PAGE_SIZE = 10;
  var pages: { page: number; text: string }[] = [];
  var currentText = "";
  var pageNum = 1;
  for (var i = 0; i < paragraphs.length; i++) {
    currentText = currentText + paragraphs[i] + "\n";
    if ((i + 1) % PAGE_SIZE === 0) {
      pages.push({ page: pageNum, text: currentText.trim() });
      currentText = "";
      pageNum = pageNum + 1;
    }
  }
  if (currentText.trim().length > 0) {
    pages.push({ page: pageNum, text: currentText.trim() });
  }
  if (pages.length === 0) {
    pages.push({ page: 1, text: text });
  }
  return pages;
}

function extractFromPptx(text: string): { page: number; text: string }[] {
  var slides = text.split("---SLIDE---");
  var result: { page: number; text: string }[] = [];
  for (var i = 0; i < slides.length; i++) {
    var slideText = slides[i].trim();
    if (slideText.length > 0) {
      result.push({ page: i + 1, text: slideText });
    }
  }
  if (result.length === 0) {
    result.push({ page: 1, text: text });
  }
  return result;
}

function extractFromPlainText(text: string): { page: number; text: string }[] {
  var lines = text.split("\n");
  var PAGE_SIZE = 30;
  var pages: { page: number; text: string }[] = [];
  var currentText = "";
  var pageNum = 1;
  for (var i = 0; i < lines.length; i++) {
    currentText = currentText + lines[i] + "\n";
    if ((i + 1) % PAGE_SIZE === 0) {
      pages.push({ page: pageNum, text: currentText.trim() });
      currentText = "";
      pageNum = pageNum + 1;
    }
  }
  if (currentText.trim().length > 0) {
    pages.push({ page: pageNum, text: currentText.trim() });
  }
  if (pages.length === 0) {
    pages.push({ page: 1, text: text });
  }
  return pages;
}

function extractMany(materials: { id: string; title: string }[], db: any): string {
  var result = "";
  for (var i = 0; i < materials.length; i++) {
    var material = materials[i];
    result = result + "=== " + material.title + " ===\n\n";
    var text = db.materialText([material.id]);
    result = result + text + "\n\n";
  }
  return result.trim();
}

export { extractPages, extractMany };
