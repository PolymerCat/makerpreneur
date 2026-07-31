import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export async function generatePdfFromExamJson(jsonObj: any): Promise<Buffer> {
  return new Promise(function(resolve, reject) {
    var tmpId = crypto.randomUUID();
    var tmpJson = path.join(os.tmpdir(), "exam_" + tmpId + ".json");
    var tmpPdf = path.join(os.tmpdir(), "exam_" + tmpId + ".pdf");
    var scriptPath = path.join(process.cwd(), "app", "study", "_lib", "python", "exam_generator.py");

    fs.writeFile(tmpJson, JSON.stringify(jsonObj), "utf-8", function(err) {
      if (err) {
        return reject(err);
      }
      var pyCommand = process.platform === "win32" ? "python" : "python3";
      
      execFile(pyCommand, [scriptPath, tmpJson, tmpPdf], function(execErr, stdout, stderr) {
        if (execErr) {
          console.error("exam_generator.py failed:", stderr || execErr.message);
          return reject(execErr);
        }
        
        fs.readFile(tmpPdf, function(readErr, data) {
          try {
            fs.unlinkSync(tmpJson);
            fs.unlinkSync(tmpPdf);
          } catch (e) {}
          
          if (readErr) {
            return reject(readErr);
          }
          resolve(data);
        });
      });
    });
  });
}
