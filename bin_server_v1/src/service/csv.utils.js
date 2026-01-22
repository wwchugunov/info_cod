function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers, rows, options = {}) {
  const delimiter = options.delimiter || ";";
  const includeSepLine =
    typeof options.includeSepLine === "boolean"
      ? options.includeSepLine
      : delimiter === ";";
  const headerLine = headers.map(escapeCsv).join(delimiter);
  const lines = rows.map((row) => row.map(escapeCsv).join(delimiter));
  const allLines = includeSepLine
    ? [`sep=${delimiter}`, headerLine, ...lines]
    : [headerLine, ...lines];
  return allLines.join("\n");
}

function toCsvBuffer(headers, rows, options = {}) {
  const encoding = options.encoding || "utf16le";
  const csv = `\ufeff${toCsv(headers, rows, options)}`;
  return Buffer.from(csv, encoding);
}

module.exports = { toCsv, toCsvBuffer };
