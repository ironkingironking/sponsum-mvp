/** Minimal one-page PDF (WinAnsi / Helvetica). No extra dependency. */
export function buildSimplePdf(title: string, lines: string[]): Buffer {
  const commands = ["BT", "/F1 12 Tf", "50 800 Td", "16 TL", `(${pdfEscape(title)}) Tj`, "T*", "/F1 10 Tf"];
  const wrapped = lines.flatMap((line) => wrapPdfLine(line, 92)).slice(0, 68);
  for (const line of wrapped) {
    commands.push(`(${pdfEscape(line)}) Tj`, "T*");
  }
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${Buffer.byteLength(stream, "latin1")} >> stream\n${stream}\nendstream endobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += object;
  }
  const xrefStart = Buffer.byteLength(body, "latin1");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `${xref}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

function wrapPdfLine(value: string, width: number): string[] {
  const text = value.trimEnd();
  if (!text) return [""];
  const words = text.split(/\s+/);
  const rows: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      rows.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) rows.push(current);
  return rows;
}

function pdfEscape(value: string): string {
  return toWinAnsi(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .slice(0, 110);
}

function toWinAnsi(value: string): string {
  return value
    .replaceAll("Ä", "\\304")
    .replaceAll("Ö", "\\326")
    .replaceAll("Ü", "\\334")
    .replaceAll("ä", "\\344")
    .replaceAll("ö", "\\366")
    .replaceAll("ü", "\\374")
    .replaceAll("ß", "\\337")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("’", "'")
    .replaceAll("«", '"')
    .replaceAll("»", '"');
}
