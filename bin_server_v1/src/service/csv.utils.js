// function escapeCsv(value, delimiter) {
//   if (value === null || value === undefined) return "";
//   const str = String(value);
//   const needsQuotes =
//     /[",\n\r]/.test(str) || (delimiter && str.includes(delimiter));
//   if (needsQuotes) {
//     return `"${str.replace(/"/g, '""')}"`;
//   }
//   return str;
// }

// function toCsv(headers, rows, options = {}) {
//   const delimiter = options.delimiter || ";";
//   const lineSeparator = options.lineSeparator || "\r\n";
//   const includeSepLine =
//     typeof options.includeSepLine === "boolean"
//       ? options.includeSepLine
//       : delimiter === ";";
//   const headerLine = headers.map((value) => escapeCsv(value, delimiter)).join(delimiter);
//   const lines = rows.map((row) =>
//     row.map((value) => escapeCsv(value, delimiter)).join(delimiter)
//   );
//   const allLines = includeSepLine
//     ? [`sep=${delimiter}`, headerLine, ...lines]
//     : [headerLine, ...lines];
//   return allLines.join(lineSeparator);
// }

// function encodeWin1251(str) {
//   const table = {
//     "А":0xC0,"Б":0xC1,"В":0xC2,"Г":0xC3,"Д":0xC4,"Е":0xC5,"Ж":0xC6,"З":0xC7,
//     "И":0xC8,"Й":0xC9,"К":0xCA,"Л":0xCB,"М":0xCC,"Н":0xCD,"О":0xCE,"П":0xCF,
//     "Р":0xD0,"С":0xD1,"Т":0xD2,"У":0xD3,"Ф":0xD4,"Х":0xD5,"Ц":0xD6,"Ч":0xD7,
//     "Ш":0xD8,"Щ":0xD9,"Ъ":0xDA,"Ы":0xDB,"Ь":0xDC,"Э":0xDD,"Ю":0xDE,"Я":0xDF,
//     "а":0xE0,"б":0xE1,"в":0xE2,"г":0xE3,"д":0xE4,"е":0xE5,"ж":0xE6,"з":0xE7,
//     "и":0xE8,"й":0xE9,"к":0xEA,"л":0xEB,"м":0xEC,"н":0xED,"о":0xEE,"п":0xEF,
//     "р":0xF0,"с":0xF1,"т":0xF2,"у":0xF3,"ф":0xF4,"х":0xF5,"ц":0xF6,"ч":0xF7,
//     "ш":0xF8,"щ":0xF9,"ъ":0xFA,"ы":0xFB,"ь":0xFC,"э":0xFD,"ю":0xFE,"я":0xFF,
//     "Ґ":0xA5,"ґ":0xB4,"І":0xB2,"і":0xB3,"Ї":0xAF,"ї":0xBF,"Є":0xAA,"є":0xBA,
//   };

//   const bytes = [];
//   for (const ch of str) {
//     const code = ch.charCodeAt(0);
//     if (code < 128) {
//       bytes.push(code);
//     } else if (table[ch]) {
//       bytes.push(table[ch]);
//     } else {
//       bytes.push(63);
//     }
//   }
//   return bytes;
// }

// function toCsvBuffer(headers, rows, options = {}) {
//   const encoding = options.encoding || "utf16le";
//   const csv = toCsv(headers, rows, options);
//   if (encoding === "win1251" || encoding === "cp1251" || encoding === "windows-1251") {
//     return Buffer.from(encodeWin1251(csv));
//   }
//   const withBom = `\ufeff${csv}`;
//   return Buffer.from(withBom, encoding);
// }

// module.exports = { toCsv, toCsvBuffer };


// "use strict";

/**
 * CSV для Excel с нормальной кириллицей.
 * По умолчанию: UTF-16LE + BOM (FF FE) — самый надежный вариант для Excel (Windows).
 */

function escapeCsv(value, delimiter) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const needsQuotes =
    /[",\n\r]/.test(str) || (delimiter && str.includes(delimiter));
  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers, rows, options = {}) {
  const delimiter = options.delimiter || ";";
  const lineSeparator = options.lineSeparator || "\r\n";
  const includeSepLine =
    typeof options.includeSepLine === "boolean"
      ? options.includeSepLine
      : delimiter === ";";

  const headerLine = headers
    .map((value) => escapeCsv(value, delimiter))
    .join(delimiter);

  const lines = rows.map((row) =>
    row.map((value) => escapeCsv(value, delimiter)).join(delimiter)
  );

  const allLines = includeSepLine
    ? [`sep=${delimiter}`, headerLine, ...lines]
    : [headerLine, ...lines];

  return allLines.join(lineSeparator);
}

function encodeWin1251(str) {
  const table = {
    "А":0xC0,"Б":0xC1,"В":0xC2,"Г":0xC3,"Д":0xC4,"Е":0xC5,"Ж":0xC6,"З":0xC7,
    "И":0xC8,"Й":0xC9,"К":0xCA,"Л":0xCB,"М":0xCC,"Н":0xCD,"О":0xCE,"П":0xCF,
    "Р":0xD0,"С":0xD1,"Т":0xD2,"У":0xD3,"Ф":0xD4,"Х":0xD5,"Ц":0xD6,"Ч":0xD7,
    "Ш":0xD8,"Щ":0xD9,"Ъ":0xDA,"Ы":0xDB,"Ь":0xDC,"Э":0xDD,"Ю":0xDE,"Я":0xDF,
    "а":0xE0,"б":0xE1,"в":0xE2,"г":0xE3,"д":0xE4,"е":0xE5,"ж":0xE6,"з":0xE7,
    "и":0xE8,"й":0xE9,"к":0xEA,"л":0xEB,"м":0xEC,"н":0xED,"о":0xEE,"п":0xEF,
    "р":0xF0,"с":0xF1,"т":0xF2,"у":0xF3,"ф":0xF4,"х":0xF5,"ц":0xF6,"ч":0xF7,
    "ш":0xF8,"щ":0xF9,"ъ":0xFA,"ы":0xFB,"ь":0xFC,"э":0xFD,"ю":0xFE,"я":0xFF,
    "Ґ":0xA5,"ґ":0xB4,"І":0xB2,"і":0xB3,"Ї":0xAF,"ї":0xBF,"Є":0xAA,"є":0xBA,
  };

  const bytes = [];
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code < 128) {
      bytes.push(code);
    } else if (Object.prototype.hasOwnProperty.call(table, ch)) {
      bytes.push(table[ch]);
    } else {
      bytes.push(63); // '?'
    }
  }
  return bytes;
}

/**
 * options.encoding:
 *  - "utf16le" (default) / "ucs2"  -> BOM FF FE + тело в utf16le
 *  - "utf8bom"                    -> BOM EF BB BF + тело в utf8
 *  - "utf8"                       -> без BOM
 *  - "cp1251" / "win1251"         -> самодельная таблица (ограниченно)
 */
function toCsvBuffer(headers, rows, options = {}) {
  const encodingRaw = options.encoding || "utf16le";
  const encoding = String(encodingRaw).toLowerCase();
  const normalized = encoding.replace(/[^a-z0-9]/g, "");

  const csv = toCsv(headers, rows, options);

  if (normalized === "win1251" || normalized === "cp1251" || normalized === "windows1251") {
    return Buffer.from(encodeWin1251(csv));
  }

  if (normalized === "utf16le" || normalized === "utf16" || normalized === "ucs2") {
    const bom = Buffer.from([0xff, 0xfe]); // UTF-16LE BOM
    const body = Buffer.from(csv, "utf16le");
    return Buffer.concat([bom, body]);
  }

  if (normalized === "utf8bom") {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const body = Buffer.from(csv, "utf8");
    return Buffer.concat([bom, body]);
  }

  if (normalized === "utf8") {
    return Buffer.from(csv, "utf8");
  }

  // fallback
  return Buffer.from(csv, encoding);
}

module.exports = { toCsv, toCsvBuffer };
