import { describe, it, expect } from "vitest";
import { inflateSync } from "zlib";
import { generateExamPdf } from "./pdf-generator";

function inflateContent(pdf: Buffer): string {
  var out = "";
  var s = pdf.toString("latin1");
  var re = /stream\r?\n/g;
  var m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    var start = m.index + m[0].length;
    var end = s.indexOf("endstream", start);
    if (end < 0) continue;
    try {
      out += inflateSync(pdf.subarray(start, end)).toString("latin1");
    } catch {}
  }
  // pdfkit hex-encodes text runs (<53554c4954> = "SULIT"); decode them.
  return out.replace(/<([0-9a-fA-F]{2})+>/g, function(m: string) {
    var hex = m.slice(1, -1);
    var txt = "";
    for (var i = 0; i < hex.length; i += 2) {
      var code = parseInt(hex.slice(i, i + 2), 16);
      txt += code >= 0x20 && code <= 0x7e ? String.fromCharCode(code) : " ";
    }
    return txt;
  });
}

describe("generateExamPdf", function() {
  it("produces a valid PDF for the exam JSON shape", async function() {
    var pdf = await generateExamPdf({
      paper: {
        course_code: "CST434",
        include_instructions: true,
        instructions: {
          num_questions_en: "FOUR (4)",
          num_questions_bm: "EMPAT (4)",
        },
      },
      questions: [
        {
          number: 1,
          text_en: "What is $H_2O$ and $x^2$ plus \\alpha?",
          text_bm: "Apakah H<sub>2</sub>O?",
          marks: 7,
        },
        {
          number: 2,
          intro_en: "Answer the following questions.",
          intro_bm: "Jawab soalan-soalan yang berikut.",
          marks: 18,
          parts: [
            { label: "a", text_en: "State the factors.", text_bm: "Nyatakan faktor-faktor." },
            { label: "b", text_en: "Explain the gateway function." },
          ],
        },
        {
          number: 3,
          text_en: "Third question with <b>bold</b> and &amp; entity.",
          marks: 25,
        },
      ],
    });

    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    var content = inflateContent(pdf);
    expect(content).toContain("SULIT");
    expect(content).toContain("CST434");
    expect(content).toContain("FOUR (4)");
    expect(content).toContain("(7/100)");
  });
});
