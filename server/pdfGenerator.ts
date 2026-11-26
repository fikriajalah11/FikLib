import fs from 'fs';

function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

export function createSamplePdfFile(
  filePath: string,
  meta: {
    title: string;
    author: string;
    category: string;
    isbn: string;
    year: number;
    description: string;
  }
): number {
  const synopsisLines = wrapLines(meta.description, 78);
  const bodyLines = [
    'LENTERA PUSTAKA - KOLEKSI LITERASI DIGITAL',
    '========================================================================',
    `Judul     : ${meta.title}`,
    `Penulis   : ${meta.author}`,
    `Kategori  : ${meta.category}`,
    `ISBN      : ${meta.isbn}  |  Tahun Terbit: ${meta.year}`,
    '------------------------------------------------------------------------',
    'Ringkasan Koleksi:',
    ...synopsisLines,
    '',
    'Bab 1: Pengantar Materi',
    'Literasi digital memungkinkan setiap pembaca mengakses sumber pengetahuan',
    'terkurasi secara cepat, terstruktur, dan berkelanjutan melalui platform',
    'perpustakaan daring. Naskah contoh ini disediakan sebagai pratinjau resmi',
    'dari sistem Lentera Pustaka dan dapat diunduh selama masa peminjaman aktif.',
    '',
    'Hak cipta koleksi dikelola untuk keperluan pembelajaran dan riset anggota.',
  ];

  const streamOps: string[] = [
    'BT',
    '/F1 16 Tf',
    '54 748 Td',
    `(${escapePdfText(meta.title)}) Tj`,
    '/F1 10 Tf',
    '0 -22 Td',
    `(${escapePdfText(`${meta.author} · ${meta.category} · ${meta.year}`)}) Tj`,
    '0 -28 Td',
  ];

  for (const line of bodyLines) {
    streamOps.push(`(${escapePdfText(line)}) Tj`);
    streamOps.push('0 -16 Td');
  }
  streamOps.push('ET');

  const contentStream = streamOps.join('\n');
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const buffer = Buffer.from(pdf, 'utf8');
  fs.writeFileSync(filePath, buffer);
  return buffer.length;
}
