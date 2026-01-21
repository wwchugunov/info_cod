function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers, rows) {
  const headerLine = headers.map(escapeCsv).join(",");
  const lines = rows.map((row) => row.map(escapeCsv).join(","));
  return [headerLine, ...lines].join("\n");
}

module.exports = { toCsv };
