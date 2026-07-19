/**
 * PDF parsing engine — PDF.js text extraction → structured ParsedReportJSON.
 * Never expose raw PDF text to UI components.
 * @module services/parser/pdf-parser
 */

import { ParseError } from '../../shared/errors.js';
import { createLogger } from '../../shared/logger.js';
import { parseMoney, categorizePurpose } from './normalize.js';

const log = createLogger('parser');

/**
 * Ensure pdf.js is available (loaded via CDN on window.pdfjsLib).
 */
function getPdfJs() {
  const lib = window.pdfjsLib;
  if (!lib) {
    throw new ParseError('PDF.js is not loaded. Check the CDN script in index.html.');
  }
  return lib;
}

/**
 * Extract plain text from every page.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
async function extractText(buffer) {
  const pdfjs = getPdfJs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push(text);
  }
  return pages.join('\n');
}

/**
 * @param {string} text
 * @param {RegExp} re
 * @returns {string|null}
 */
function match1(text, re) {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Parse Kansas Receipts & Expenditures style text into structured JSON.
 * Tolerant of OCR/spacing noise; returns warnings rather than throwing on soft failures.
 * @param {string} text
 * @returns {import('../../models/entities.js').ParsedReportJSON}
 */
export function parseTextToReport(text) {
  const warnings = [];
  const flat = text.replace(/\s+/g, ' ').trim();

  const name =
    match1(flat, /Name of Candidate[:\s]+([A-Za-z0-9 .,'-]{3,80})/i) ||
    match1(flat, /Candidate[:\s]+([A-Za-z0-9 .,'-]{3,80})/i) ||
    match1(flat, /Committee Name[:\s]+([A-Za-z0-9 .,'-]{3,80})/i);

  if (!name) warnings.push('Could not detect candidate name; using Unknown Candidate');

  const office =
    match1(flat, /Office Sought[:\s]+([A-Za-z0-9 ]{3,60})/i) ||
    match1(flat, /(Kansas House|Kansas Senate|Governor|Attorney General|Secretary of State)/i) ||
    'Kansas House';

  const district =
    match1(flat, /District[:\s#]*([0-9]{1,3})/i) ||
    match1(flat, /\bHD[:\s-]*([0-9]{1,3})\b/i) ||
    '';

  const cycle =
    match1(flat, /Election Cycle[:\s]+(20[0-9]{2})/i) ||
    match1(flat, /\b(20[0-9]{2})\b Election/i) ||
    '2026';

  const periodStart = match1(flat, /Period (?:Beginning|From)[:\s]+([0-9/\-]{6,12})/i);
  const periodEnd = match1(flat, /Period (?:Ending|To|Through)[:\s]+([0-9/\-]{6,12})/i);

  const beginningBalance = parseMoney(
    match1(flat, /Beginning (?:Cash|Balance)[:\s$]*([0-9,]+\.?[0-9]*)/i)
  );
  const cashOnHand = parseMoney(
    match1(flat, /Cash on Hand[:\s$]*([0-9,]+\.?[0-9]*)/i) ||
      match1(flat, /Closing Balance[:\s$]*([0-9,]+\.?[0-9]*)/i)
  );
  const totalReceipts = parseMoney(
    match1(flat, /Total (?:Receipts|Contributions)[:\s$]*([0-9,]+\.?[0-9]*)/i)
  );
  const totalExpenditures = parseMoney(
    match1(flat, /Total (?:Expenditures|Disbursements)[:\s$]*([0-9,]+\.?[0-9]*)/i)
  );
  const totalLoans = parseMoney(match1(flat, /Total Loans[:\s$]*([0-9,]+\.?[0-9]*)/i));

  const contributions = extractTabularContributions(text, warnings);
  const expenses = extractTabularExpenses(text, warnings);

  /** @type {import('../../models/entities.js').ParsedReportJSON} */
  const parsed = {
    candidate: {
      name: name || 'Unknown Candidate',
      office,
      district,
      cycle,
    },
    summary: {
      beginningBalance,
      cashOnHand,
      totalReceipts: totalReceipts || sumAmounts(contributions),
      totalExpenditures: totalExpenditures || sumAmounts(expenses),
      totalLoans,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
    },
    contributions,
    expenses,
    loans: [],
    warnings,
  };

  log.info('Parsed report', {
    candidate: parsed.candidate.name,
    contributions: contributions.length,
    expenses: expenses.length,
    warnings: warnings.length,
  });

  return parsed;
}

/**
 * @param {Array<{amount?: number}>} rows
 */
function sumAmounts(rows) {
  return rows.reduce((s, r) => s + (r.amount || 0), 0);
}

/**
 * Lightweight line-oriented extractors for Schedule A-like rows.
 * @param {string} text
 * @param {string[]} warnings
 */
function extractTabularContributions(text, warnings) {
  const lines = text.split(/\n+/);
  const rows = [];
  const moneyRe = /\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})/;
  const dateRe = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;

  let inScheduleA = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/schedule\s*a\b/i.test(line)) inScheduleA = true;
    if (/schedule\s*b\b/i.test(line)) inScheduleA = false;
    if (!inScheduleA && !/contributor|donor/i.test(line)) continue;

    const money = line.match(moneyRe);
    if (!money) continue;
    const amount = parseMoney(money[1]);
    if (amount <= 0 || amount > 1_000_000) continue;

    const date = (line.match(dateRe) || [])[1];
    const namePart = line
      .replace(dateRe, '')
      .replace(moneyRe, '')
      .replace(/\bKS\b.*/, '')
      .replace(/[^A-Za-z0-9 .,'&-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (namePart.length < 3 || /total|subtotal|page/i.test(namePart)) continue;

    rows.push({
      donorName: namePart.slice(0, 120),
      amount,
      date: date || undefined,
      schedule: 'A',
    });
  }

  if (!rows.length) warnings.push('No Schedule A contribution rows detected');
  return rows;
}

/**
 * @param {string} text
 * @param {string[]} warnings
 */
function extractTabularExpenses(text, warnings) {
  const lines = text.split(/\n+/);
  const rows = [];
  const moneyRe = /\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})/;
  const dateRe = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;

  let inScheduleB = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/schedule\s*b\b/i.test(line)) inScheduleB = true;
    if (/schedule\s*[cd]\b/i.test(line)) inScheduleB = false;
    if (!inScheduleB && !/payee|expenditure|vendor/i.test(line)) continue;

    const money = line.match(moneyRe);
    if (!money) continue;
    const amount = parseMoney(money[1]);
    if (amount <= 0 || amount > 1_000_000) continue;

    const date = (line.match(dateRe) || [])[1];
    const purposeHint = line;
    const namePart = line
      .replace(dateRe, '')
      .replace(moneyRe, '')
      .replace(/[^A-Za-z0-9 .,'&-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (namePart.length < 3 || /total|subtotal|page/i.test(namePart)) continue;

    rows.push({
      vendorName: namePart.slice(0, 120),
      amount,
      date: date || undefined,
      purpose: purposeHint.slice(0, 200),
      category: categorizePurpose(purposeHint),
      schedule: 'B',
    });
  }

  if (!rows.length) warnings.push('No Schedule B expense rows detected');
  return rows;
}

/**
 * Parse a PDF ArrayBuffer or File into ParsedReportJSON.
 * Also accepts pre-structured JSON files (for mirrored catalog reports).
 * @param {ArrayBuffer|Uint8Array|File|Blob|string} input
 * @param {{ fileName?: string }} [opts]
 * @returns {Promise<import('../../models/entities.js').ParsedReportJSON>}
 */
export async function parseReport(input, opts = {}) {
  try {
    if (typeof input === 'string') {
      return parseTextToReport(input);
    }

    const fileName = opts.fileName || (input instanceof File ? input.name : '');
    let buffer;

    if (input instanceof ArrayBuffer) buffer = input;
    else if (ArrayBuffer.isView(input)) buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    else if (input instanceof Blob) buffer = await input.arrayBuffer();
    else throw new ParseError('Unsupported parse input type');

    if (/\.json$/i.test(fileName)) {
      const text = new TextDecoder().decode(buffer);
      const json = JSON.parse(text);
      validateParsedShape(json);
      return json;
    }

    // JSON payload without extension (mirrored catalog)
    const asText = new TextDecoder().decode(buffer);
    if (asText.trim().startsWith('{')) {
      try {
        const json = JSON.parse(asText);
        if (json.candidate && (json.contributions || json.summary)) {
          validateParsedShape(json);
          return json;
        }
      } catch {
        /* fall through to PDF */
      }
    }

    const text = await extractText(buffer);
    if (!text || text.trim().length < 20) {
      throw new ParseError('PDF contained insufficient extractable text (may be scanned image-only)', {
        fileName,
      });
    }
    return parseTextToReport(text);
  } catch (err) {
    if (err instanceof ParseError) throw err;
    log.error('Parse failed', err);
    throw new ParseError(err.message || 'Failed to parse report', { cause: err });
  }
}

/**
 * @param {any} json
 */
function validateParsedShape(json) {
  if (!json || typeof json !== 'object') throw new ParseError('Invalid JSON report');
  if (!json.candidate?.name) throw new ParseError('JSON report missing candidate.name');
  if (!Array.isArray(json.contributions)) json.contributions = [];
  if (!Array.isArray(json.expenses)) json.expenses = [];
  if (!json.summary) json.summary = {};
}

export { extractText };
