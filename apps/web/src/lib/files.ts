/** Upload limits and formatting shared by the comment composer. Bytes are stored by the server. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
