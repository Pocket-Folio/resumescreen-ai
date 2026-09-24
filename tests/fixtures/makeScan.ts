/** Generates tests/fixtures/scanned.pdf and scanned.png: resume text rendered as an image (no text layer). */
import fs from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { jsPDF } from "jspdf";

const lines = [
  "MARIA GONZALEZ",
  "Phoenix, AZ | maria.gonzalez@example.com | (602) 555-0187",
  "",
  "PROFESSIONAL EXPERIENCE",
  "Senior Accountant, Desert Logistics (Mar 2019 - Present)",
  "- Prepared monthly financial statements and variance reports",
  "- Built forecasting models in Excel for a $120M business unit",
  "",
  "EDUCATION",
  "B.S. Accounting, Arizona State University (2015)",
  "",
  "CERTIFICATIONS",
  "Certified Public Accountant (CPA), Arizona",
];
const c = createCanvas(1275, 1650);
const g = c.getContext("2d");
g.fillStyle = "#fff";
g.fillRect(0, 0, 1275, 1650);
g.fillStyle = "#111";
lines.forEach((l, i) => {
  g.font = i === 0 ? "bold 44px sans-serif" : "30px sans-serif";
  g.fillText(l, 100, 150 + i * 52);
});
const png = c.toBuffer("image/png");
fs.writeFileSync("tests/fixtures/scanned.png", png);
const doc = new jsPDF({ unit: "pt", format: "letter" });
doc.addImage(c.toBuffer("image/jpeg", 80).toString("base64"), "JPEG", 0, 0, 612, 792);
fs.writeFileSync("tests/fixtures/scanned.pdf", Buffer.from(doc.output("arraybuffer")));
console.log("fixtures written");
