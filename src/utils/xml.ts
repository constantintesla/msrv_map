/** Escape text for XML content */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Parse XML string to Document */
export function parseXml(xmlString: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const error = doc.querySelector('parsererror');
  if (error) throw new Error(`XML parse error: ${error.textContent}`);
  return doc;
}

/** Serialize Document to string */
export function serializeXml(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}

/** Format coordinate for KML: lng,lat,0 */
export function formatKmlCoord(lat: number, lng: number): string {
  return `${lng},${lat},0`;
}
