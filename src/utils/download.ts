/** Download a Blob as a file */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Download text content as a file */
export function downloadText(text: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([text], { type: mimeType });
  downloadBlob(blob, filename);
}
