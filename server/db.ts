import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createSamplePdfFile } from './pdfGenerator.ts';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'pdfs');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'library.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('member', 'admin')),
      member_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      isbn TEXT NOT NULL,
      published_year INTEGER NOT NULL,
      pages INTEGER NOT NULL,
      total_copies INTEGER NOT NULL,
      available_copies INTEGER NOT NULL,
      description TEXT NOT NULL,
      cover_url TEXT,
      pdf_filename TEXT,
      pdf_original_name TEXT,
      pdf_size_bytes INTEGER DEFAULT 0,
      uploaded_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      borrowed_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      returned_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('borrowed', 'returned', 'overdue')),
      reminder_sent_h2 INTEGER NOT NULL DEFAULT 0,
      reminder_sent_overdue INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      loan_id TEXT,
      book_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('due_soon', 'overdue', 'loan_created', 'loan_returned', 'new_book', 'system')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS historical_circulation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_label TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      borrowed_count INTEGER NOT NULL,
      returned_count INTEGER NOT NULL,
      on_time_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  insertSetting.run('reminder_lead_hours', '48');
  insertSetting.run('default_loan_days', '7');

  const bookCount = (
    db.prepare('SELECT COUNT(*) as count FROM books').get() as { count: number }
  ).count;

  if (bookCount === 0) {
    seedInitialLibraryData();
  }
}

function seedInitialLibraryData(): void {
  const initialBooks = [
    {
      id: 'bk_arsitektur_sistem',
      title: 'Arsitektur Sistem Terdistribusi Modern',
      author: 'Dr. Hendra Wijaya',
      category: 'Teknologi',
      isbn: '978-602-481-912-4',
      published_year: 2025,
      pages: 342,
      total_copies: 5,
      available_copies: 4,
      description:
        'Panduan komprehensif merancang layanan terdistribusi yang tangguh, konsistensi replikasi data, antrean pesan, dan observabilitas sistem skala produksi.',
      cover_url: '/src/assets/images/cover_algoritma_sistem_1795675454527.jpg',
    },
    {
      id: 'bk_sejarah_maritim',
      title: 'Jejak Pelayaran & Niaga Nusantara',
      author: 'Prof. Ratna Sari Dewi',
      category: 'Sejarah & Sastra',
      isbn: '978-623-214-088-2',
      published_year: 2024,
      pages: 418,
      total_copies: 4,
      available_copies: 3,
      description:
        'Menelusuri jalur rempah maritim, naskah pelayaran kuno, serta pertukaran budaya dan ekonomi antar-bandar pelabuhan di kepulauan Nusantara.',
      cover_url: '/src/assets/images/cover_sejarah_nusantara_1795675455550.jpg',
    },
    {
      id: 'bk_desain_antarmuka',
      title: 'Tipografi & Sistem Desain Antarmuka',
      author: 'Nadia Kusuma, M.Ds.',
      category: 'Desain',
      isbn: '978-602-773-410-9',
      published_year: 2025,
      pages: 264,
      total_copies: 6,
      available_copies: 5,
      description:
        'Prinsip grid editorial, hierarki tipografi modern, aksesibilitas kontras WCAG, dan arsitektur komponen antarmuka yang konsisten lintas perangkat.',
      cover_url: '/src/assets/images/cover_desain_antarmuka_1795675455780.jpg',
    },
    {
      id: 'bk_ekonomi_digital',
      title: 'Peta Transformasi Ekonomi Digital Asia',
      author: 'Budi Santoso, Ph.D.',
      category: 'Ekonomi',
      isbn: '978-623-552-194-7',
      published_year: 2026,
      pages: 310,
      total_copies: 4,
      available_copies: 4,
      description:
        'Analisis mendalam tentang inklusi keuangan digital, ekosistem UMKM berbasis platform, serta kebijakan tata kelola data di kawasan Asia Tenggara.',
      cover_url: '/src/assets/images/cover_ekonomi_digital_1795675455736.jpg',
    },
    {
      id: 'bk_kecerdasan_komputasi',
      title: 'Fondasi Statistika & Pemodelan Data',
      author: 'Ir. Bagus Pratama',
      category: 'Teknologi',
      isbn: '978-602-319-705-1',
      published_year: 2024,
      pages: 295,
      total_copies: 5,
      available_copies: 5,
      description:
        'Memahami probabilitas terapan, inferensi statistik, regresi, dan evaluasi model analitik untuk pengambilan keputusan berbasis bukti.',
      cover_url: null,
    },
    {
      id: 'bk_ekologi_tropis',
      title: 'Konservasi Hutan Hujan & Keanekaragaman Hayati',
      author: 'Dr. Lestari Handayani',
      category: 'Sains',
      isbn: '978-623-891-330-5',
      published_year: 2025,
      pages: 376,
      total_copies: 3,
      available_copies: 3,
      description:
        'Kajian ilmiah mengenai dinamika ekosistem hutan tropis Indonesia, penyerapan karbon, dan strategi restorasi lahan berbasis komunitas.',
      cover_url: null,
    },
    {
      id: 'bk_sastra_kontemporer',
      title: 'Antologi Esai Kebudayaan & Ruang Kota',
      author: 'Seno Adi Nugroho',
      category: 'Sejarah & Sastra',
      isbn: '978-602-648-219-8',
      published_year: 2023,
      pages: 228,
      total_copies: 4,
      available_copies: 4,
      description:
        'Kumpulan esai reflektif tentang ruang publik kota, arsitektur ingatan kolektif, dan transformasi budaya baca masyarakat urban.',
      cover_url: null,
    },
    {
      id: 'bk_fisika_energi',
      title: 'Rekayasa Energi Terbarukan & Mikrogrid',
      author: 'Prof. Arif Rahman',
      category: 'Sains',
      isbn: '978-623-401-677-3',
      published_year: 2026,
      pages: 388,
      total_copies: 5,
      available_copies: 5,
      description:
        'Konsep fisika dan rekayasa sistem pembangkit surya, penyimpanan energi baterai solid-state, serta manajemen jaringan mikro untuk daerah kepulauan.',
      cover_url: null,
    },
  ];

  const insertBook = db.prepare(`
    INSERT INTO books (
      id, title, author, category, isbn, published_year, pages,
      total_copies, available_copies, description, cover_url,
      pdf_filename, pdf_original_name, pdf_size_bytes, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const book of initialBooks) {
    const pdfFilename = `${book.id}.pdf`;
    const pdfPath = path.join(UPLOAD_DIR, pdfFilename);
    const sizeBytes = createSamplePdfFile(pdfPath, {
      title: book.title,
      author: book.author,
      category: book.category,
      isbn: book.isbn,
      year: book.published_year,
      description: book.description,
    });

    insertBook.run(
      book.id,
      book.title,
      book.author,
      book.category,
      book.isbn,
      book.published_year,
      book.pages,
      book.total_copies,
      book.available_copies,
      book.description,
      book.cover_url,
      pdfFilename,
      `${book.id}.pdf`,
      sizeBytes,
      'Sistem Perpustakaan',
      now
    );
  }

  const historyRows = [
    { month: 'Jun 2026', order: 1, borrowed: 34, returned: 32, onTime: 30 },
    { month: 'Jul 2026', order: 2, borrowed: 42, returned: 40, onTime: 37 },
    { month: 'Agu 2026', order: 3, borrowed: 51, returned: 48, onTime: 45 },
    { month: 'Sep 2026', order: 4, borrowed: 47, returned: 46, onTime: 44 },
    { month: 'Okt 2026', order: 5, borrowed: 63, returned: 59, onTime: 56 },
    { month: 'Nov 2026', order: 6, borrowed: 58, returned: 54, onTime: 51 },
  ];

  const insertHistory = db.prepare(`
    INSERT INTO historical_circulation (month_label, sort_order, borrowed_count, returned_count, on_time_count)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const row of historyRows) {
    insertHistory.run(row.month, row.order, row.borrowed, row.returned, row.onTime);
  }
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}
