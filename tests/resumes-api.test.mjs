import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const baseUrl = process.env.RESUME_TEST_URL ?? "http://localhost:3000";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function makePdf(pageCount = 1, text = "Synthetic resume experience") {
  const objects = [];
  const pageIds = Array.from({ length: pageCount }, (_, index) => 3 + index * 2);
  const fontId = 3 + pageCount * 2;
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  pageIds.forEach((pageId, index) => {
    const contentId = pageId + 1;
    const pageText = text ? `${text} page ${index + 1}` : "";
    const stream = `BT /F1 12 Tf 72 720 Td (${pageText}) Tj ET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf);
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

test("PDF extractor initializes its server runtime and returns extracted text and page count", async () => {
  const response = await sendFile("runtime.pdf", "application/pdf", makePdf(2));
  assert.equal(response.status, 200, (await response.clone().json()).error);
  const { document } = await response.json();

  assert.match(document.extractedText, /Synthetic resume experience page 1/);
  assert.equal(document.pageCount, 2);
});

test("PDF extractor uses pdf-parse documented server CanvasFactory configuration", async () => {
  const source = await readFile(new URL("../features/documents/extract.ts", import.meta.url), "utf8");

  assert.match(source, /import\s+\{\s*CanvasFactory\s*\}\s+from\s+["']pdf-parse\/worker["']/);
  assert.match(source, /new\s+PDFParse\(\{\s*data:\s*buffer,\s*CanvasFactory\s*\}\)/);
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, nameBytes);
    localOffset += local.length + nameBytes.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const entryCount = Object.keys(entries).length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function makeDocx(text = "Synthetic DOCX resume experience") {
  return makeZip({
    "[Content_Types].xml": "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/></Types>",
    "word/document.xml": `<?xml version=\"1.0\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  });
}

async function sendFile(name, type, bytes) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  return fetch(`${baseUrl}/api/resumes`, { method: "POST", body: form });
}

test("PDF e DOCX seguem temporários quando apenas Auth está configurado", async () => {
  const pdfResponse = await sendFile("resume.pdf", "application/pdf", makePdf());
  assert.equal(pdfResponse.status, 200, (await pdfResponse.clone().json()).error);
  const pdf = await pdfResponse.json();
  assert.equal(pdf.document.status, "processed");
  assert.equal(pdf.document.originalName, "resume.pdf");
  assert.equal(pdf.document.mimeType, "application/pdf");
  assert.equal(pdf.document.pageCount, 1);
  assert.match(pdf.document.extractedText, /Synthetic resume experience/);
  assert.ok(pdf.document.id);
  assert.ok(Date.parse(pdf.document.uploadedAt));
  assert.ok(Date.parse(pdf.document.processedAt));
  assert.equal(pdf.document.storage.persisted, false);

  const docxResponse = await sendFile("resume.docx", DOCX_MIME, makeDocx());
  assert.equal(docxResponse.status, 200, (await docxResponse.clone().json()).error);
  const docx = await docxResponse.json();
  assert.equal(docx.document.pageCount, null);
  assert.match(docx.document.extractedText, /Synthetic DOCX resume experience/);
  assert.equal(docx.document.storage.persisted, false);
});

test("rejeita tamanho acima de 4 MiB e PDF com mais de 20 páginas", async () => {
  const oversized = await sendFile("large.pdf", "application/pdf", Buffer.alloc(4 * 1024 * 1024 + 1, 0x41));
  assert.equal(oversized.status, 413);
  assert.match((await oversized.json()).error, /4 MB/);

  const tooManyPages = await sendFile("many-pages.pdf", "application/pdf", makePdf(21));
  assert.equal(tooManyPages.status, 422);
  assert.match((await tooManyPages.json()).error, /20 páginas/);
});

test("rejeita formato, MIME e arquivo corrompido com mensagens seguras", async () => {
  const unsupported = await sendFile("resume.txt", "text/plain", Buffer.from("private content"));
  assert.equal(unsupported.status, 400);
  assert.match((await unsupported.json()).error, /PDF ou DOCX/);

  const mimeMismatch = await sendFile("resume.pdf", "text/plain", makePdf());
  assert.equal(mimeMismatch.status, 400);
  assert.doesNotMatch((await mimeMismatch.json()).error, /Synthetic|private content/);

  const missingMime = await sendFile("resume.pdf", "", makePdf());
  assert.equal(missingMime.status, 400);

  const corrupt = await sendFile("corrupt.pdf", "application/pdf", Buffer.from("%PDF-1.4\nnot a real PDF"));
  assert.equal(corrupt.status, 422);
  assert.match((await corrupt.json()).error, /íntegro/);

  const corruptDocx = await sendFile("corrupt.docx", DOCX_MIME, Buffer.from("not a ZIP file"));
  assert.equal(corruptDocx.status, 422);
  assert.match((await corruptDocx.json()).error, /íntegro/);

  const noText = await sendFile("image-only.pdf", "application/pdf", makePdf(1, ""));
  assert.equal(noText.status, 422);
  assert.match((await noText.json()).error, /texto extraível/);
});

test("aceita PDF no limite de páginas e reduz nome com caminho para basename", async () => {
  const response = await sendFile("../../resume.pdf", "application/pdf", makePdf(20));
  assert.equal(response.status, 200);
  const document = (await response.json()).document;
  assert.equal(document.pageCount, 20);
  assert.equal(document.originalName, "resume.pdf");
});

test("substituir um currículo processa o novo documento sem reutilizar o anterior", async () => {
  const first = await sendFile("first.pdf", "application/pdf", makePdf(1, "First resume"));
  const second = await sendFile("second.pdf", "application/pdf", makePdf(1, "Second resume"));
  const firstDocument = (await first.json()).document;
  const secondDocument = (await second.json()).document;
  assert.notEqual(firstDocument.id, secondDocument.id);
  assert.equal(secondDocument.originalName, "second.pdf");
  assert.match(secondDocument.extractedText, /Second resume/);
  assert.doesNotMatch(secondDocument.extractedText, /First resume/);
});

if (process.env.RESUME_WRITE_FIXTURES === "1") {
  const fixtureDirectory = new URL("./.fixtures/", import.meta.url);
  await mkdir(fixtureDirectory, { recursive: true });
  await writeFile(new URL("resume.pdf", fixtureDirectory), makePdf());
  await writeFile(new URL("resume.docx", fixtureDirectory), makeDocx());
  await writeFile(new URL("invalid.txt", fixtureDirectory), "not a supported resume format");
}
