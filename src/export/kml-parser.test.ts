import { describe, it, expect } from 'vitest';
import { parseKmlForTest } from './kml-parser';

describe('kml-parser — icon/color', () => {
  const wrap = (style: string, placemark: string) => `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${style}${placemark}</Document></kml>`;

  it('default paddle icon для type → icon === undefined', () => {
    const kml = wrap(
      '<Style id="s1"><IconStyle><Icon><href>https://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon></IconStyle></Style>',
      '<Placemark><name>Marker</name><styleUrl>#s1</styleUrl><Point><coordinates>10,20</coordinates></Point></Placemark>',
    );
    const { markers } = parseKmlForTest(kml);
    expect(markers.length).toBe(1);
    expect(markers[0].type).toBe('danger');
    expect(markers[0].icon).toBeUndefined();
  });

  it('curated non-default icon → icon = remoteUrl', () => {
    const kml = wrap(
      '<Style id="s1"><IconStyle><Icon><href>https://maps.google.com/mapfiles/kml/shapes/flag.png</href></Icon></IconStyle></Style>',
      '<Placemark><name>Marker</name><styleUrl>#s1</styleUrl><Point><coordinates>10,20</coordinates></Point></Placemark>',
    );
    const { markers } = parseKmlForTest(kml);
    expect(markers[0].icon).toBe('https://maps.google.com/mapfiles/kml/shapes/flag.png');
  });

  it('arbitrary icon URL → icon сохраняется как есть', () => {
    const kml = wrap(
      '<Style id="s1"><IconStyle><Icon><href>https://example.com/custom.png</href></Icon></IconStyle></Style>',
      '<Placemark><name>Marker</name><styleUrl>#s1</styleUrl><Point><coordinates>10,20</coordinates></Point></Placemark>',
    );
    const { markers } = parseKmlForTest(kml);
    expect(markers[0].icon).toBe('https://example.com/custom.png');
  });

  it('IconStyle color без иконки → color в MarkerData', () => {
    // KML color: AABBGGRR. Для #abcdef → ff ef cd ab
    const kml = wrap(
      '<Style id="s1"><IconStyle><Icon><href>https://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon><color>ffefcdab</color></IconStyle></Style>',
      '<Placemark><name>Marker</name><styleUrl>#s1</styleUrl><Point><coordinates>10,20</coordinates></Point></Placemark>',
    );
    const { markers } = parseKmlForTest(kml);
    // default blu-circle → type=default, но цвет задан вручную → color применяется
    expect(markers[0].color?.toLowerCase()).toBe('#abcdef');
  });
});
