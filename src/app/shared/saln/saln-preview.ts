import JSZip from 'jszip';

// Shows the SALN Word file as pages. Wingdings tick boxes are swapped for
// plain symbols in this temporary copy only; the saved file is not touched.
export async function renderSalnPreview(buf: ArrayBuffer, host: HTMLElement): Promise<void> {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file('word/document.xml');
  if (f) {
    let xml = await f.async('string');
    xml = xml.replace(/<w:sym\b[^>]*w:char="([0-9A-Fa-f]{4})"[^>]*\/>/g, (_m, c: string) =>
      `<w:t>${['F078', 'F0FE', 'F0FD', 'F06E', 'F0A8'].includes(c.toUpperCase()) ? '&#9745;' : '&#9744;'}</w:t>`);
    zip.file('word/document.xml', xml);
  }
  const out = await zip.generateAsync({ type: 'arraybuffer' });
  const { renderAsync } = await import('docx-preview');
  host.innerHTML = '';
  await renderAsync(out, host, undefined, { inWrapper: true, ignoreWidth: false, ignoreHeight: false, breakPages: true, className: 'docx' });
}
