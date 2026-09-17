// CSV с разделителем «;» и BOM, чтобы Excel открывал кириллицу корректно.
export function downloadCsv(name, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = '\uFEFF' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
  downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${name}-${today()}.csv`);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const today = () => new Date().toISOString().slice(0, 10);
