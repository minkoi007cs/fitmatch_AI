/**
 * CSV import and export utilities with security hardening.
 * - Prevents CSV Formula Injection (DDE attacks) by escaping `=,+,-,@,\t,\r`.
 * - Includes UTF-8 BOM (\uFEFF) for Excel compatibility.
 * - Parses CSV with delimiter detection and column mapping.
 */
/**
 * Escapes a single CSV value, handling quotes, commas, newlines, and formula injection.
 */
function escapeCsvCell(val, sanitizeFormulas) {
    if (val === null || val === undefined) {
        return '';
    }
    let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    // CSV Formula Injection mitigation (RFC 4180 extension)
    if (sanitizeFormulas && /^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }
    // Quote if contains delimiter, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
/**
 * Converts an array of objects or 2D array to safe CSV string.
 */
export function toCsv(data, options = {}) {
    const { headers, sanitizeFormulas = true, delimiter = ',', includeBom = true, } = options;
    if (!Array.isArray(data) || data.length === 0) {
        return includeBom ? '\uFEFF' : '';
    }
    let headerRow = [];
    let rowsData = [];
    const firstItem = data[0];
    if (!firstItem) {
        return includeBom ? '\uFEFF' : '';
    }
    if (Array.isArray(firstItem)) {
        // 2D Array
        if (headers) {
            headerRow = headers;
            rowsData = data;
        }
        else {
            headerRow = firstItem.map((_, i) => `Column ${i + 1}`);
            rowsData = data;
        }
    }
    else {
        // Array of Objects
        headerRow = headers ?? Object.keys(firstItem);
        rowsData = data.map((row) => headerRow.map((key) => row[key]));
    }
    const lines = [];
    // Header line
    lines.push(headerRow.map((h) => escapeCsvCell(h, false)).join(delimiter));
    // Data lines
    for (const row of rowsData) {
        lines.push(row.map((val) => escapeCsvCell(val, sanitizeFormulas)).join(delimiter));
    }
    const csvContent = lines.join('\r\n');
    return includeBom ? `\uFEFF${csvContent}` : csvContent;
}
/**
 * Triggers a browser file download for a CSV string.
 */
export function downloadCsv(csvText, filename = 'export.csv') {
    if (typeof window === 'undefined' || typeof document === 'undefined')
        return;
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
/**
 * Parses raw CSV string into headers and structured rows.
 */
export function parseCsv(csvText, options = {}) {
    const { limit, headerMap, trim = true, } = options;
    // Strip BOM if present
    const cleaned = csvText.replace(/^\uFEFF/, '').trim();
    if (!cleaned) {
        return { headers: [], rows: [], totalRows: 0 };
    }
    // Detect delimiter if not provided
    let delimiter = options.delimiter;
    if (!delimiter) {
        const firstLine = cleaned.split(/\r?\n/)[0] || '';
        const commas = (firstLine.match(/,/g) || []).length;
        const semicolons = (firstLine.match(/;/g) || []).length;
        const tabs = (firstLine.match(/\t/g) || []).length;
        if (tabs > commas && tabs > semicolons)
            delimiter = '\t';
        else if (semicolons > commas)
            delimiter = ';';
        else
            delimiter = ',';
    }
    // Parse lines considering quotes
    const rawRows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const nextChar = cleaned[i + 1];
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // skip escaped quote
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (char === delimiter && !inQuotes) {
            currentRow.push(trim ? currentCell.trim() : currentCell);
            currentCell = '';
        }
        else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(trim ? currentCell.trim() : currentCell);
            currentCell = '';
            if (currentRow.some((c) => c.length > 0)) {
                rawRows.push(currentRow);
            }
            currentRow = [];
        }
        else {
            currentCell += char;
        }
    }
    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(trim ? currentCell.trim() : currentCell);
        if (currentRow.some((c) => c.length > 0)) {
            rawRows.push(currentRow);
        }
    }
    if (rawRows.length === 0) {
        return { headers: [], rows: [], totalRows: 0 };
    }
    const rawHeaders = rawRows[0] ?? [];
    const mappedHeaders = rawHeaders.map((h) => (headerMap && headerMap[h] ? headerMap[h] : h));
    const dataRows = rawRows.slice(1);
    const totalRows = dataRows.length;
    const rowsToProcess = limit ? dataRows.slice(0, limit) : dataRows;
    const rows = rowsToProcess.map((row) => {
        const obj = {};
        for (let j = 0; j < mappedHeaders.length; j++) {
            const key = mappedHeaders[j];
            if (!key)
                continue;
            let val = row[j] ?? '';
            // Strip leading formula escape quote if present
            if (typeof val === 'string' && val.startsWith("'") && /^[=+\-@\t\r]/.test(val.slice(1))) {
                val = val.slice(1);
            }
            obj[key] = val;
        }
        return obj;
    });
    return {
        headers: mappedHeaders,
        rows,
        totalRows,
    };
}
//# sourceMappingURL=csv.js.map