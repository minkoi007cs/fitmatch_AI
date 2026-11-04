/**
 * CSV import and export utilities with security hardening.
 * - Prevents CSV Formula Injection (DDE attacks) by escaping `=,+,-,@,\t,\r`.
 * - Includes UTF-8 BOM (\uFEFF) for Excel compatibility.
 * - Parses CSV with delimiter detection and column mapping.
 */
export interface ToCsvOptions {
    /** Column headers. If omitted, extracted from keys of first object. */
    headers?: string[];
    /** Sanitize cells starting with =, +, -, @ to prevent spreadsheet formula execution. Defaults to true. */
    sanitizeFormulas?: boolean;
    /** Delimiter to use. Defaults to comma `,`. */
    delimiter?: string;
    /** Include UTF-8 BOM for Microsoft Excel. Defaults to true. */
    includeBom?: boolean;
}
export interface ParseCsvOptions {
    /** Delimiter. Defaults to auto-detect (comma, semicolon, tab). */
    delimiter?: string;
    /** Limit rows returned for preview purposes. */
    limit?: number;
    /** Map raw header names to target schema keys: { [rawHeader: string]: targetKey } */
    headerMap?: Record<string, string>;
    /** Trim whitespace from cell values. Defaults to true. */
    trim?: boolean;
}
export interface ParsedCsvResult<T = Record<string, any>> {
    headers: string[];
    rows: T[];
    totalRows: number;
}
/**
 * Converts an array of objects or 2D array to safe CSV string.
 */
export declare function toCsv(data: Array<Record<string, any>> | Array<any[]>, options?: ToCsvOptions): string;
/**
 * Triggers a browser file download for a CSV string.
 */
export declare function downloadCsv(csvText: string, filename?: string): void;
/**
 * Parses raw CSV string into headers and structured rows.
 */
export declare function parseCsv<T = Record<string, any>>(csvText: string, options?: ParseCsvOptions): ParsedCsvResult<T>;
//# sourceMappingURL=csv.d.ts.map