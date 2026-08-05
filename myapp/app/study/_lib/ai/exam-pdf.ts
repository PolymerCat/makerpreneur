import { generateExamPdf } from "./pdf-generator";

export async function generatePdfFromExamJson(jsonObj: any): Promise<Buffer> {
  return generateExamPdf(jsonObj);
}
