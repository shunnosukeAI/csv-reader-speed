// A fast drop-in replacement for csv-reader 1.0.0 (make.fun's reference CSV reader).
//
// run(input) returns exactly csv-reader 1.0.0's answer for every input {text, header}: the JSON value
// {columns, rows, errors} under csv-reader's broken-row policy:
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled, "" inside it one quote and
//     each CRLF or lone CR inside it read as LF; what follows its closing quote, up to the next comma or line
//     break, is appended as it stands (quote_junk, when the field ends); a quote that never closes is a literal
//     character, and the text after it is read again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the records after it (every record
//     when header is false), each padded with "" (short_row, with fields: its count) or cut (long_row, with
//     extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts on (every LF, CRLF and lone CR
//     inside a quoted field counted), row its record's index in rows (null for the header), in the order met.
//
// Where the reference reads one character at a time and builds each field a character at a time, this reader
// slices whole runs of ordinary characters at once: unquoted fields are scanned by a tight character loop that
// stops at the field's own delimiters, and quoted fields are located with indexOf and normalized in bulk.
// Pure: no clock, no randomness, no locale, nothing kept from one call to the next.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const len = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // The field just read: its value, and (for the junk and re-read paths) how many characters were kept.
  let fVal = '';
  let fAdded = 0;

  // Reads unquoted characters from pos onto the prefix `init`, up to the next comma or line break: a CR not
  // followed by LF is dropped (stray_cr). Sets fVal and fAdded (the characters kept past `init`) and returns
  // how the field ended.
  function scanUnquoted(init) {
    let seg = pos; // the start of the current unbroken run
    let parts = null; // the runs before a stray CR, once one occurs
    let added = 0;
    let i = pos;
    for (;;) {
      let c = -1;
      while (i < len) {
        c = text.charCodeAt(i);
        if (c === 44 || c === 10 || c === 13) break;
        i += 1;
      }
      const runLen = i - seg;
      added += runLen;
      if (i >= len) {
        fVal = parts === null
          ? (init === '' ? text.slice(seg, i) : init + text.slice(seg, i))
          : init + parts.join('') + text.slice(seg, i);
        fAdded = added;
        pos = i;
        return END;
      }
      if (c === 44) { // ','
        fVal = parts === null
          ? (init === '' ? text.slice(seg, i) : init + text.slice(seg, i))
          : init + parts.join('') + text.slice(seg, i);
        fAdded = added;
        pos = i + 1;
        return COMMA;
      }
      if (c === 10) { // LF
        fVal = parts === null
          ? (init === '' ? text.slice(seg, i) : init + text.slice(seg, i))
          : init + parts.join('') + text.slice(seg, i);
        fAdded = added;
        pos = i + 1;
        line += 1;
        return LINE_BREAK;
      }
      // A CR: a line break when an LF follows, else a stray CR that is dropped while the field reads on.
      if (text.charCodeAt(i + 1) === 10) {
        fVal = parts === null
          ? (init === '' ? text.slice(seg, i) : init + text.slice(seg, i))
          : init + parts.join('') + text.slice(seg, i);
        fAdded = added;
        pos = i + 2;
        line += 1;
        return LINE_BREAK;
      }
      if (parts === null) parts = [text.slice(seg, i)];
      else parts.push(text.slice(seg, i));
      error('stray_cr');
      i += 1;
      seg = i;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fVal and returns how the field ended.
  function scanQuoted() {
    const open = pos;
    // The closing quote is the next quote that is not doubled.
    let i = open + 1;
    let close = -1;
    let hadDoubled = false;
    for (;;) {
      const q = text.indexOf('"', i);
      if (q === -1) break;
      if (text[q + 1] === '"') { i = q + 2; hadDoubled = true; continue; }
      close = q;
      break;
    }
    if (close === -1) {
      // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
      // (No line count moved: newlines inside the unclosed quote are counted by the re-read instead.)
      pos = open + 1;
      error('unterminated_quote');
      return scanUnquoted('"');
    }
    let value = text.slice(open + 1, close);
    // Doubled quotes collapse to one; each CRLF or lone CR is read as LF (and counts one line).
    // (No doubled quote was passed over, so the slice holds no quote at all and needs no collapse.)
    if (value.indexOf('\r') !== -1) value = value.replace(/\r\n|\r/g, '\n');
    if (hadDoubled) value = value.replace(/""/g, '"');
    // Every LF in the finished value is one more line the record spans.
    let k = value.indexOf('\n');
    if (k !== -1) {
      let n = 0;
      do { n += 1; k = value.indexOf('\n', k + 1); } while (k !== -1);
      line += n;
    }
    pos = close + 1;
    if (pos >= len) { fVal = value; return END; }
    const c = text[pos];
    if (c === ',') { pos += 1; fVal = value; return COMMA; }
    if (c === '\n') { pos += 1; line += 1; fVal = value; return LINE_BREAK; }
    if (c === '\r' && text[pos + 1] === '\n') { pos += 2; line += 1; fVal = value; return LINE_BREAK; }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    const ended = scanUnquoted(value);
    if (fAdded > 0) error('quote_junk');
    return ended;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      ended = quoted ? scanQuoted() : scanUnquoted('');
      fields.push(fVal);
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
