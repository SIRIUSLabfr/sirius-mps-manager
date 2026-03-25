import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedData {
  headers: string[];
  rows: string[][];
  sheetNames?: string[];
  selectedSheet?: string;
  sourceType: 'excel' | 'csv' | 'pdf';
  fileName: string;
  fileSize: number;
}

export async function parseExcelFile(file: File, sheetName?: string): Promise<ParsedData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = sheetName || wb.SheetNames[0];
  const ws = wb.Sheets[sheet];
  const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find header row (first row with > 2 non-empty cells)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const filled = raw[i].filter(c => String(c).trim() !== '').length;
    if (filled >= 3) { headerIdx = i; break; }
  }

  const headers = raw[headerIdx].map(h => String(h).trim());
  const rows = raw.slice(headerIdx + 1)
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(r => r.map(c => String(c).trim()));

  return {
    headers,
    rows,
    sheetNames: wb.SheetNames,
    selectedSheet: sheet,
    sourceType: 'excel',
    fileName: file.name,
    fileSize: file.size,
  };
}

export function parseCsvFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    // Try to detect encoding
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;

      // Detect delimiter
      const firstLines = text.split('\n').slice(0, 5).join('\n');
      let delimiter = ',';
      if (firstLines.split(';').length > firstLines.split(',').length) delimiter = ';';
      if (firstLines.split('\t').length > firstLines.split(delimiter).length) delimiter = '\t';

      Papa.parse(text, {
        delimiter,
        skipEmptyLines: true,
        complete: (result) => {
          const data = result.data as string[][];
          if (data.length < 2) { reject(new Error('Datei enthält keine Daten')); return; }

          // Find header row
          let headerIdx = 0;
          for (let i = 0; i < Math.min(data.length, 10); i++) {
            const filled = data[i].filter(c => String(c).trim() !== '').length;
            if (filled >= 3) { headerIdx = i; break; }
          }

          const headers = data[headerIdx].map(h => String(h).trim());
          const rows = data.slice(headerIdx + 1)
            .filter(r => r.some(c => String(c).trim() !== ''))
            .map(r => r.map(c => String(c).trim()));

          resolve({
            headers,
            rows,
            sourceType: 'csv',
            fileName: file.name,
            fileSize: file.size,
          });
        },
        error: (err) => reject(err),
      });
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsText(file, 'UTF-8');
  });
}

export async function parsePdfFile(file: File): Promise<ParsedData | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    let allText = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      allText += pageText + '\n';
    }

    // Try to detect tabular structure
    const lines = allText.split('\n').filter(l => l.trim());
    const tabularLines = lines.filter(l => {
      // Lines with multiple segments separated by spaces that look like table rows
      const parts = l.trim().split(/\s{2,}/);
      return parts.length >= 3;
    });

    if (tabularLines.length >= 5) {
      // Attempt table extraction
      const parsed = tabularLines.map(l => l.trim().split(/\s{2,}/));
      const maxCols = Math.max(...parsed.map(r => r.length));
      const normalized = parsed.map(r => {
        while (r.length < maxCols) r.push('');
        return r;
      });

      const headers = normalized[0];
      const rows = normalized.slice(1);

      return {
        headers,
        rows,
        sourceType: 'pdf',
        fileName: file.name,
        fileSize: file.size,
      };
    }

    // Could not parse as table
    return null;
  } catch {
    return null;
  }
}

// Auto-mapping logic
const IST_MAPPING_HINTS: Record<string, string[]> = {
  ist_manufacturer: ['hersteller', 'manufacturer', 'mfg', 'marke', 'brand', 'fabrikat'],
  ist_model: ['modell', 'model', 'typ', 'type', 'gerät', 'device', 'bezeichnung', 'gerätetyp', 'gerätebezeichnung'],
  ist_serial: ['seriennummer', 'serial', 'sn', 's/n', 'serien-nr', 'seriennr', 'serial number', 'serialnumber'],
  ist_ip: ['ip', 'ip-adresse', 'ip adresse', 'ipaddress', 'ip address', 'netzwerk'],
  ist_inventory_number: ['inventarnr', 'inventar', 'inventory', 'inv', 'inventarnummer', 'asset', 'asset-nr', 'assetnr', 'anlagennr', 'anlagennummer'],
  ist_building: ['gebäude', 'building', 'haus', 'objekt'],
  ist_floor: ['etage', 'floor', 'stockwerk', 'og', 'geschoss', 'ebene'],
  ist_room: ['zimmer', 'raum', 'room', 'büro', 'office', 'raumbezeichnung', 'raumnr', 'raumnummer'],
  customer_device_number: ['kundennr', 'kd-nr', 'kdnr', 'customer', 'gerätenr', 'lfd', 'nr', 'nummer', 'gerätenummer', 'lfd. nr', 'lfd.nr'],
  location_name: ['standort', 'location', 'adresse', 'address', 'filiale', 'niederlassung', 'kostenstelle', 'standortbezeichnung', 'lieferadresse'],
};

const SOLL_MAPPING_HINTS: Record<string, string[]> = {
  soll_manufacturer: ['hersteller', 'manufacturer', 'mfg', 'marke', 'brand', 'fabrikat'],
  soll_model: ['modell', 'model', 'typ', 'type', 'gerät', 'device', 'bezeichnung', 'gerätetyp', 'gerätebezeichnung'],
  soll_serial: ['seriennummer', 'serial', 'sn', 's/n', 'serien-nr', 'seriennr'],
  soll_device_id: ['id', 'geräte-id', 'sirius-id', 'device-id', 'deviceid'],
  soll_options: ['optionen', 'options', 'ausstattung', 'zubehör', 'accessories'],
  soll_building: ['gebäude', 'building', 'haus', 'objekt'],
  soll_floor: ['etage', 'floor', 'stockwerk', 'og', 'geschoss', 'ebene'],
  soll_room: ['zimmer', 'raum', 'room', 'büro', 'office', 'raumbezeichnung'],
  location_name: ['standort', 'location', 'adresse', 'address', 'filiale', 'niederlassung', 'kostenstelle', 'lieferadresse'],
};

const MAPPING_HINTS = IST_MAPPING_HINTS;

export type TargetField = string;

export const TARGET_FIELD_LABELS: Record<string, string> = {
  ist_manufacturer: 'IST: Hersteller',
  ist_model: 'IST: Modell',
  ist_serial: 'IST: Seriennummer',
  ist_ip: 'IST: IP-Adresse',
  ist_inventory_number: 'IST: Inventarnummer',
  ist_building: 'IST: Gebäude',
  ist_floor: 'IST: Etage',
  ist_room: 'IST: Zimmer/Raum',
  customer_device_number: 'Kundennummer / Lfd.Nr',
  location_name: 'Standort/Adresse',
  ignore: '– ignorieren –',
};

export const SOLL_TARGET_FIELD_LABELS: Record<string, string> = {
  soll_manufacturer: 'SOLL: Hersteller',
  soll_model: 'SOLL: Modell',
  soll_serial: 'SOLL: Seriennummer',
  soll_device_id: 'SOLL: Geräte-ID',
  soll_options: 'SOLL: Optionen',
  soll_building: 'SOLL: Gebäude',
  soll_floor: 'SOLL: Etage',
  soll_room: 'SOLL: Zimmer/Raum',
  location_name: 'Standort/Adresse',
  ignore: '– ignorieren –',
};

export function autoSuggestMapping(sourceHeaders: string[], mode: 'ist' | 'soll' = 'ist'): Record<number, TargetField> {
  const hints = mode === 'soll' ? SOLL_MAPPING_HINTS : IST_MAPPING_HINTS;
  const mapping: Record<number, TargetField> = {};
  const used = new Set<string>();

  sourceHeaders.forEach((header, idx) => {
    const h = header.toLowerCase().trim();
    for (const [field, fieldHints] of Object.entries(hints)) {
      if (used.has(field)) continue;
      if (fieldHints.some(hint => h.includes(hint) || hint.includes(h))) {
        mapping[idx] = field as TargetField;
        used.add(field);
        return;
      }
    }
    mapping[idx] = 'ignore';
  });

  return mapping;
}
