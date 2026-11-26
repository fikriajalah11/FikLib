import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db, generateId, initDatabase, UPLOAD_DIR } from './server/db.ts';
import {
  type AuthenticatedRequest,
  hashPassword,
  requireAdmin,
  requireAuth,
  safeCompareStrings,
  signToken,
  verifyPassword,
} from './server/auth.ts';
import {
  getReminderLeadHours,
  runDueNotificationSweep,
} from './server/notifications.ts';

initDatabase();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// Configure secure PDF upload storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, `pdf_${crypto.randomBytes(10).toString('hex')}.pdf`);
  },
});

const uploadPdf = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.mimetype !== 'application/pdf' && ext !== '.pdf') {
      cb(new Error('Hanya berkas berformat PDF (.pdf) yang diperbolehkan.'));
      return;
    }
    cb(null, true);
  },
});

function verifyPdfMagicBytes(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(5);
    const bytesRead = fs.readSync(fd, header, 0, 5, 0);
    fs.closeSync(fd);
    return bytesRead === 5 && header.toString('ascii') === '%PDF-';
  } catch {
    return false;
  }
}

function removeUploadedFileSafely(filename: string | null | undefined): void {
  if (!filename) return;
  const resolved = path.resolve(UPLOAD_DIR, path.basename(filename));
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) return;
  if (fs.existsSync(resolved)) {
    try {
      fs.unlinkSync(resolved);
    } catch {
      // ignore cleanup error
    }
  }
}

function getEnvAdminPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function getAdminCount(): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
    .get() as { count: number };
  return row.count;
}

// ==================== AUTH ROUTES ====================

app.get('/api/auth/status', (_req, res) => {
  const envPasscode = getEnvAdminPasscode();
  const adminCount = getAdminCount();
  const bookStats = db
    .prepare(
      'SELECT COUNT(*) as totalBooks, SUM(CASE WHEN pdf_filename IS NOT NULL THEN 1 ELSE 0 END) as totalPdfs, COUNT(DISTINCT category) as categoriesCount FROM books'
    )
    .get() as { totalBooks: number; totalPdfs: number; categoriesCount: number };

  res.json({
    adminClaimed: adminCount > 0 || envPasscode.length > 0,
    usesEnvPasscode: envPasscode.length > 0,
    libraryStats: {
      totalBooks: bookStats.totalBooks || 0,
      totalPdfs: bookStats.totalPdfs || 0,
      categoriesCount: bookStats.categoriesCount || 0,
    },
  });
});

app.post('/api/auth/member/register', (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
    return;
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 80) {
    res.status(400).json({ error: 'Nama lengkap harus 2 hingga 80 karakter.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Format email tidak valid.' });
    return;
  }
  if (password.length < 6 || password.length > 128) {
    res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(cleanEmail) as { id: string } | undefined;
  if (existing) {
    res.status(409).json({ error: 'Email tersebut sudah terdaftar. Silakan masuk.' });
    return;
  }

  const id = generateId('usr');
  const memberCode = `ANG-${crypto.randomInt(10000, 99999)}`;
  const createdAt = new Date().toISOString();
  const passwordHash = hashPassword(password);

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, member_code, created_at)
     VALUES (?, ?, ?, ?, 'member', ?, ?)`
  ).run(id, cleanName, cleanEmail, passwordHash, memberCode, createdAt);

  db.prepare(
    `INSERT INTO notifications (id, user_id, loan_id, book_id, type, title, message, is_read, created_at)
     VALUES (?, ?, NULL, NULL, 'system', ?, ?, 0, ?)`
  ).run(
    generateId('ntf'),
    id,
    'Selamat Datang di Lentera Pustaka',
    `Akun anggota (${memberCode}) Anda aktif. Anda dapat meminjam koleksi buku daring, membaca PDF, dan menerima pengingat tenggat otomatis.`,
    createdAt
  );

  const token = signToken({
    uid: id,
    role: 'member',
    email: cleanEmail,
    name: cleanName,
  });

  res.status(201).json({
    token,
    user: {
      id,
      name: cleanName,
      email: cleanEmail,
      role: 'member',
      memberCode,
    },
  });
});

app.post('/api/auth/member/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db
    .prepare(
      'SELECT id, name, email, password_hash, role, member_code FROM users WHERE email = ?'
    )
    .get(cleanEmail) as
    | {
        id: string;
        name: string;
        email: string;
        password_hash: string;
        role: 'member' | 'admin';
        member_code: string;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Email atau kata sandi salah.' });
    return;
  }

  if (user.role !== 'member') {
    res.status(403).json({
      error:
        'Akun ini terdaftar sebagai Pengelola (Admin). Silakan masuk melalui tab Portal Admin.',
    });
    return;
  }

  runDueNotificationSweep();

  const token = signToken({
    uid: user.id,
    role: 'member',
    email: user.email,
    name: user.name,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      memberCode: user.member_code,
    },
  });
});

app.post('/api/auth/admin/claim', (req, res) => {
  const envPasscode = getEnvAdminPasscode();
  if (envPasscode.length > 0) {
    res.status(403).json({
      error:
        'Akses admin dikelola oleh ADMIN_PASSCODE pada konfigurasi lingkungan. Gunakan form Masuk Admin.',
    });
    return;
  }

  if (getAdminCount() > 0) {
    res.status(409).json({
      error:
        'Akun Admin pertama sudah diklaim. Silakan masuk menggunakan kredensial Admin.',
    });
    return;
  }

  const { name, email, password } = req.body ?? {};
  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
    return;
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 80) {
    res.status(400).json({ error: 'Nama lengkap harus 2 hingga 80 karakter.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Format email tidak valid.' });
    return;
  }
  if (password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Kata sandi Admin minimal 8 karakter.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(cleanEmail) as { id: string } | undefined;
  if (existing) {
    res.status(409).json({
      error: 'Email tersebut sudah terdaftar sebagai anggota. Gunakan email khusus admin.',
    });
    return;
  }

  const id = generateId('adm');
  const memberCode = 'ADM-0001';
  const createdAt = new Date().toISOString();
  const passwordHash = hashPassword(password);

  const claimTx = db.transaction(() => {
    if (getAdminCount() > 0) {
      throw new Error('ALREADY_CLAIMED');
    }
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, member_code, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?, ?)`
    ).run(id, cleanName, cleanEmail, passwordHash, memberCode, createdAt);
  });

  try {
    claimTx();
  } catch {
    res.status(409).json({ error: 'Akun Admin sudah diklaim sebelumnya.' });
    return;
  }

  const token = signToken({
    uid: id,
    role: 'admin',
    email: cleanEmail,
    name: cleanName,
  });

  res.status(201).json({
    token,
    user: {
      id,
      name: cleanName,
      email: cleanEmail,
      role: 'admin',
      memberCode,
    },
  });
});

app.post('/api/auth/admin/login', (req, res) => {
  const envPasscode = getEnvAdminPasscode();

  if (envPasscode.length > 0) {
    const { passcode, email } = req.body ?? {};
    if (typeof passcode !== 'string' || !safeCompareStrings(passcode, envPasscode)) {
      res.status(401).json({ error: 'Kode akses Admin tidak valid.' });
      return;
    }

    const cleanEmail =
      typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? email.trim().toLowerCase()
        : 'admin@lenterapustaka.id';

    let adminUser = db
      .prepare(
        "SELECT id, name, email, role, member_code FROM users WHERE email = ? AND role = 'admin'"
      )
      .get(cleanEmail) as
      | {
          id: string;
          name: string;
          email: string;
          role: 'admin';
          member_code: string;
        }
      | undefined;

    if (!adminUser) {
      const id = generateId('adm');
      const createdAt = new Date().toISOString();
      db.prepare(
        `INSERT OR IGNORE INTO users (id, name, email, password_hash, role, member_code, created_at)
         VALUES (?, ?, ?, ?, 'admin', ?, ?)`
      ).run(
        id,
        'Pustakawan Utama',
        cleanEmail,
        hashPassword(crypto.randomBytes(24).toString('hex')),
        `ADM-${crypto.randomInt(1000, 9999)}`,
        createdAt
      );
      adminUser = db
        .prepare(
          "SELECT id, name, email, role, member_code FROM users WHERE email = ? AND role = 'admin'"
        )
        .get(cleanEmail) as {
        id: string;
        name: string;
        email: string;
        role: 'admin';
        member_code: string;
      };
    }

    runDueNotificationSweep();

    const token = signToken({
      uid: adminUser.id,
      role: 'admin',
      email: adminUser.email,
      name: adminUser.name,
    });

    res.json({
      token,
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: 'admin',
        memberCode: adminUser.member_code,
      },
    });
    return;
  }

  // Fallback to claimed admin email + password
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email dan kata sandi Admin wajib diisi.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db
    .prepare(
      'SELECT id, name, email, password_hash, role, member_code FROM users WHERE email = ?'
    )
    .get(cleanEmail) as
    | {
        id: string;
        name: string;
        email: string;
        password_hash: string;
        role: 'member' | 'admin';
        member_code: string;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Email atau kata sandi Admin salah.' });
    return;
  }

  if (user.role !== 'admin') {
    res.status(403).json({
      error: 'Akun ini adalah Anggota biasa. Silakan masuk melalui Portal Anggota.',
    });
    return;
  }

  runDueNotificationSweep();

  const token = signToken({
    uid: user.id,
    role: 'admin',
    email: user.email,
    name: user.name,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      memberCode: user.member_code,
    },
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db
    .prepare('SELECT id, name, email, role, member_code FROM users WHERE id = ?')
    .get(req.user!.uid) as
    | {
        id: string;
        name: string;
        email: string;
        role: 'member' | 'admin';
        member_code: string;
      }
    | undefined;

  if (!user) {
    res.status(401).json({ error: 'Akun tidak ditemukan.' });
    return;
  }

  const unread = db
    .prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    )
    .get(user.id) as { count: number };

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      memberCode: user.member_code,
    },
    unreadNotifications: unread.count,
  });
});

// ==================== BOOKS & PDF ACCESS ====================

app.get('/api/books', requireAuth, (req: AuthenticatedRequest, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const category =
    typeof req.query.category === 'string' ? req.query.category.trim() : '';

  const allBooks = db
    .prepare(
      `SELECT id, title, author, category, isbn, published_year, pages,
              total_copies, available_copies, description, cover_url,
              CASE WHEN pdf_filename IS NOT NULL THEN 1 ELSE 0 END as has_pdf,
              pdf_original_name, pdf_size_bytes, uploaded_by, created_at
       FROM books
       ORDER BY created_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const myActiveLoans = db
    .prepare(
      "SELECT id, book_id, status, due_at FROM loans WHERE user_id = ? AND status IN ('borrowed', 'overdue')"
    )
    .all(req.user!.uid) as Array<{
    id: string;
    book_id: string;
    status: string;
    due_at: string;
  }>;

  const activeLoanByBook = new Map(myActiveLoans.map((l) => [l.book_id, l]));

  const filtered = allBooks
    .filter((b) => {
      if (category && category !== 'Semua' && b.category !== category) return false;
      if (search) {
        const hay = `${b.title} ${b.author} ${b.isbn} ${b.category}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    })
    .map((b) => {
      const loan = activeLoanByBook.get(String(b.id));
      return {
        ...b,
        has_pdf: Boolean(b.has_pdf),
        active_loan: loan || null,
      };
    });

  res.json({ books: filtered });
});

app.get('/api/books/:id/pdf', requireAuth, (req: AuthenticatedRequest, res) => {
  const bookId = String(req.params.id || '').trim();
  const book = db
    .prepare('SELECT id, title, pdf_filename, pdf_original_name FROM books WHERE id = ?')
    .get(bookId) as
    | {
        id: string;
        title: string;
        pdf_filename: string | null;
        pdf_original_name: string | null;
      }
    | undefined;

  if (!book || !book.pdf_filename) {
    res.status(404).json({ error: 'Berkas PDF tidak tersedia untuk buku ini.' });
    return;
  }

  // Members can read/download if they have an active loan OR admins can read any PDF
  if (req.user!.role !== 'admin') {
    const activeLoan = db
      .prepare(
        "SELECT id FROM loans WHERE book_id = ? AND user_id = ? AND status IN ('borrowed', 'overdue')"
      )
      .get(book.id, req.user!.uid);
    if (!activeLoan) {
      res.status(403).json({
        error: 'Pinjam buku ini terlebih dahulu untuk membaca atau mengunduh berkas PDF.',
      });
      return;
    }
  }

  const safeName = path.basename(book.pdf_filename);
  const resolved = path.resolve(UPLOAD_DIR, safeName);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(resolved)) {
    res.status(404).json({ error: 'Berkas PDF tidak ditemukan di penyimpanan.' });
    return;
  }

  const isDownload = req.query.download === '1';
  const cleanDownloadName = (book.pdf_original_name || `${book.id}.pdf`).replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `${isDownload ? 'attachment' : 'inline'}; filename="${cleanDownloadName}"`
  );
  fs.createReadStream(resolved).pipe(res);
});

// ==================== LOANS (BORROW / RETURN / EXTEND) ====================

app.get('/api/loans', requireAuth, (req: AuthenticatedRequest, res) => {
  runDueNotificationSweep();

  const rows = db
    .prepare(
      `SELECT l.id, l.book_id, l.user_id, l.borrowed_at, l.due_at, l.returned_at, l.status,
              b.title as book_title, b.author as book_author, b.category as book_category,
              b.cover_url as book_cover_url,
              CASE WHEN b.pdf_filename IS NOT NULL THEN 1 ELSE 0 END as has_pdf
       FROM loans l
       JOIN books b ON b.id = l.book_id
       WHERE l.user_id = ?
       ORDER BY
         CASE l.status WHEN 'overdue' THEN 0 WHEN 'borrowed' THEN 1 ELSE 2 END,
         l.borrowed_at DESC`
    )
    .all(req.user!.uid) as Array<Record<string, unknown>>;

  res.json({
    loans: rows.map((r) => ({ ...r, has_pdf: Boolean(r.has_pdf) })),
  });
});

app.post('/api/loans', requireAuth, (req: AuthenticatedRequest, res) => {
  const { bookId, durationDays } = req.body ?? {};
  if (typeof bookId !== 'string' || !bookId.trim()) {
    res.status(400).json({ error: 'ID buku wajib disertakan.' });
    return;
  }

  const allowedDays = [1, 3, 7, 14];
  const days = allowedDays.includes(Number(durationDays)) ? Number(durationDays) : 7;

  const now = new Date();
  const borrowedAt = now.toISOString();
  const dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const borrowTx = db.transaction(() => {
    const book = db
      .prepare('SELECT id, title, available_copies FROM books WHERE id = ?')
      .get(bookId.trim()) as
      | { id: string; title: string; available_copies: number }
      | undefined;

    if (!book) {
      throw new Error('BOOK_NOT_FOUND');
    }
    if (book.available_copies <= 0) {
      throw new Error('OUT_OF_STOCK');
    }

    const existingActive = db
      .prepare(
        "SELECT id FROM loans WHERE book_id = ? AND user_id = ? AND status IN ('borrowed', 'overdue')"
      )
      .get(book.id, req.user!.uid);

    if (existingActive) {
      throw new Error('ALREADY_BORROWED');
    }

    const loanId = generateId('ln');
    db.prepare(
      `INSERT INTO loans (id, book_id, user_id, borrowed_at, due_at, status)
       VALUES (?, ?, ?, ?, ?, 'borrowed')`
    ).run(loanId, book.id, req.user!.uid, borrowedAt, dueAt);

    db.prepare(
      'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?'
    ).run(book.id);

    db.prepare(
      `INSERT INTO notifications (id, user_id, loan_id, book_id, type, title, message, is_read, created_at)
       VALUES (?, ?, ?, ?, 'loan_created', ?, ?, 0, ?)`
    ).run(
      generateId('ntf'),
      req.user!.uid,
      loanId,
      book.id,
      'Peminjaman Buku Berhasil',
      `Anda meminjam "${book.title}" selama ${days} hari. Batas pengembalian: ${new Date(
        dueAt
      ).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}.`,
      borrowedAt
    );

    return { loanId, bookTitle: book.title };
  });

  try {
    const result = borrowTx();
    runDueNotificationSweep();
    res.status(201).json({
      loanId: result.loanId,
      message: `Berhasil meminjam "${result.bookTitle}".`,
      dueAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'BOOK_NOT_FOUND') {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
    } else if (msg === 'OUT_OF_STOCK') {
      res.status(409).json({ error: 'Stok salinan digital sedang habis.' });
    } else if (msg === 'ALREADY_BORROWED') {
      res.status(409).json({ error: 'Anda masih memiliki pinjaman aktif untuk buku ini.' });
    } else {
      res.status(500).json({ error: 'Gagal memproses peminjaman.' });
    }
  }
});

app.post('/api/loans/:id/return', requireAuth, (req: AuthenticatedRequest, res) => {
  const loanId = String(req.params.id || '').trim();
  const nowIso = new Date().toISOString();

  const returnTx = db.transaction(() => {
    const loan = db
      .prepare(
        `SELECT l.id, l.book_id, l.user_id, l.status, b.title as book_title
         FROM loans l JOIN books b ON b.id = l.book_id
         WHERE l.id = ?`
      )
      .get(loanId) as
      | {
          id: string;
          book_id: string;
          user_id: string;
          status: string;
          book_title: string;
        }
      | undefined;

    if (!loan) throw new Error('NOT_FOUND');
    if (loan.user_id !== req.user!.uid && req.user!.role !== 'admin') {
      throw new Error('FORBIDDEN');
    }
    if (loan.status === 'returned') throw new Error('ALREADY_RETURNED');

    db.prepare(
      "UPDATE loans SET status = 'returned', returned_at = ? WHERE id = ?"
    ).run(nowIso, loan.id);

    db.prepare(
      'UPDATE books SET available_copies = MIN(total_copies, available_copies + 1) WHERE id = ?'
    ).run(loan.book_id);

    db.prepare(
      `INSERT INTO notifications (id, user_id, loan_id, book_id, type, title, message, is_read, created_at)
       VALUES (?, ?, ?, ?, 'loan_returned', ?, ?, 0, ?)`
    ).run(
      generateId('ntf'),
      loan.user_id,
      loan.id,
      loan.book_id,
      'Pengembalian Buku Diterima',
      `Terima kasih! Buku "${loan.book_title}" telah dikembalikan secara daring.`,
      nowIso
    );

    return loan;
  });

  try {
    const loan = returnTx();
    res.json({ message: `Buku "${loan.book_title}" berhasil dikembalikan.` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') res.status(404).json({ error: 'Data peminjaman tidak ditemukan.' });
    else if (msg === 'FORBIDDEN') res.status(403).json({ error: 'Akses ditolak.' });
    else if (msg === 'ALREADY_RETURNED')
      res.status(409).json({ error: 'Buku sudah dikembalikan sebelumnya.' });
    else res.status(500).json({ error: 'Gagal memproses pengembalian.' });
  }
});

app.post('/api/loans/:id/extend', requireAuth, (req: AuthenticatedRequest, res) => {
  const loanId = String(req.params.id || '').trim();
  const loan = db
    .prepare(
      `SELECT l.id, l.user_id, l.book_id, l.due_at, l.status, b.title as book_title
       FROM loans l JOIN books b ON b.id = l.book_id WHERE l.id = ?`
    )
    .get(loanId) as
    | {
        id: string;
        user_id: string;
        book_id: string;
        due_at: string;
        status: string;
        book_title: string;
      }
    | undefined;

  if (!loan) {
    res.status(404).json({ error: 'Data peminjaman tidak ditemukan.' });
    return;
  }
  if (loan.user_id !== req.user!.uid && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak.' });
    return;
  }
  if (loan.status !== 'borrowed') {
    res.status(409).json({
      error: 'Hanya pinjaman aktif yang belum terlambat yang dapat diperpanjang.',
    });
    return;
  }

  const newDue = new Date(
    new Date(loan.due_at).getTime() + 3 * 24 * 60 * 60 * 1000
  ).toISOString();

  db.prepare(
    'UPDATE loans SET due_at = ?, reminder_sent_h2 = 0 WHERE id = ?'
  ).run(newDue, loan.id);

  db.prepare(
    `INSERT INTO notifications (id, user_id, loan_id, book_id, type, title, message, is_read, created_at)
     VALUES (?, ?, ?, ?, 'system', ?, ?, 0, ?)`
  ).run(
    generateId('ntf'),
    loan.user_id,
    loan.id,
    loan.book_id,
    'Perpanjangan Durasi Pinjam',
    `Masa pinjam "${loan.book_title}" diperpanjang 3 hari hingga ${new Date(
      newDue
    ).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}.`,
    new Date().toISOString()
  );

  res.json({ dueAt: newDue, message: 'Durasi peminjaman diperpanjang 3 hari.' });
});

// ==================== NOTIFICATIONS ====================

app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
  runDueNotificationSweep();
  const notifications = db
    .prepare(
      `SELECT id, loan_id, book_id, type, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 60`
    )
    .all(req.user!.uid) as Array<Record<string, unknown>>;

  res.json({
    notifications: notifications.map((n) => ({
      ...n,
      is_read: Boolean(n.is_read),
    })),
  });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(
    req.user!.uid
  );
  res.json({ ok: true });
});

app.post('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
  const ntfId = String(req.params.id || '').trim();
  db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).run(ntfId, req.user!.uid);
  res.json({ ok: true });
});

// ==================== ANALYTICS & DASHBOARD ====================

app.get('/api/analytics', requireAuth, (_req, res) => {
  runDueNotificationSweep();

  const bookMetrics = db
    .prepare(
      `SELECT COUNT(*) as totalTitles,
              COALESCE(SUM(total_copies), 0) as totalCopies,
              COALESCE(SUM(available_copies), 0) as availableCopies,
              COALESCE(SUM(CASE WHEN pdf_filename IS NOT NULL THEN 1 ELSE 0 END), 0) as totalPdfs
       FROM books`
    )
    .get() as {
    totalTitles: number;
    totalCopies: number;
    availableCopies: number;
    totalPdfs: number;
  };

  const loanMetrics = db
    .prepare(
      `SELECT
         COUNT(*) as totalLoans,
         SUM(CASE WHEN status = 'borrowed' THEN 1 ELSE 0 END) as activeBorrowed,
         SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdueCount,
         SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returnedCount,
         SUM(CASE WHEN status = 'returned' AND returned_at <= due_at THEN 1 ELSE 0 END) as onTimeReturned
       FROM loans`
    )
    .get() as {
    totalLoans: number;
    activeBorrowed: number;
    overdueCount: number;
    returnedCount: number;
    onTimeReturned: number;
  };

  const memberCount = (
    db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'member'").get() as {
      count: number;
    }
  ).count;

  const history = db
    .prepare(
      'SELECT month_label, borrowed_count, returned_count, on_time_count FROM historical_circulation ORDER BY sort_order ASC'
    )
    .all() as Array<{
    month_label: string;
    borrowed_count: number;
    returned_count: number;
    on_time_count: number;
  }>;

  // Fold live loans into the latest month so charts reflect real-time actions immediately
  const liveBorrowed = loanMetrics.totalLoans || 0;
  const liveReturned = loanMetrics.returnedCount || 0;
  const liveOnTime = loanMetrics.onTimeReturned || 0;

  const monthlyTrend = history.map((row, idx) => {
    const isLatest = idx === history.length - 1;
    return {
      month: row.month_label,
      peminjaman: row.borrowed_count + (isLatest ? liveBorrowed : 0),
      pengembalian: row.returned_count + (isLatest ? liveReturned : 0),
      tepatWaktu: row.on_time_count + (isLatest ? liveOnTime : 0),
    };
  });

  const categoryBreakdown = db
    .prepare(
      `SELECT b.category as category,
              COUNT(DISTINCT b.id) as totalBooks,
              COUNT(l.id) as loanCount
       FROM books b
       LEFT JOIN loans l ON l.book_id = b.id
       GROUP BY b.category
       ORDER BY totalBooks DESC`
    )
    .all() as Array<{ category: string; totalBooks: number; loanCount: number }>;

  const totalHistoricalBorrowed = history.reduce((acc, r) => acc + r.borrowed_count, 0);
  const totalHistoricalReturned = history.reduce((acc, r) => acc + r.returned_count, 0);
  const totalHistoricalOnTime = history.reduce((acc, r) => acc + r.on_time_count, 0);

  const combinedReturned = totalHistoricalReturned + liveReturned;
  const combinedOnTime = totalHistoricalOnTime + liveOnTime;
  const onTimeRate =
    combinedReturned > 0 ? Math.round((combinedOnTime / combinedReturned) * 100) : 96;

  const topBooks = db
    .prepare(
      `SELECT b.id, b.title, b.author, b.category, b.available_copies, b.total_copies,
              COUNT(l.id) as borrow_count
       FROM books b
       LEFT JOIN loans l ON l.book_id = b.id
       GROUP BY b.id
       ORDER BY borrow_count DESC, b.created_at DESC
       LIMIT 5`
    )
    .all();

  const lastSweepRow = db
    .prepare("SELECT value FROM settings WHERE key = 'last_sweep_at'")
    .get() as { value: string } | undefined;

  res.json({
    kpis: {
      totalTitles: bookMetrics.totalTitles,
      totalPdfs: bookMetrics.totalPdfs,
      activeLoans: (loanMetrics.activeBorrowed || 0) + (loanMetrics.overdueCount || 0),
      overdueLoans: loanMetrics.overdueCount || 0,
      totalCirculation: totalHistoricalBorrowed + liveBorrowed,
      onTimeRate,
      registeredMembers: memberCount,
    },
    monthlyTrend,
    categoryBreakdown,
    topBooks,
    reminderLeadHours: getReminderLeadHours(),
    lastSweepAt: lastSweepRow?.value || new Date().toISOString(),
  });
});

// ==================== ADMIN ROUTES & PDF UPLOAD ====================

app.post(
  '/api/admin/books',
  requireAuth,
  requireAdmin,
  (req: AuthenticatedRequest, res) => {
    uploadPdf.single('pdf')(req, res, (uploadErr) => {
      if (uploadErr) {
        res.status(400).json({ error: uploadErr.message || 'Gagal mengunggah PDF.' });
        return;
      }

      const file = req.file;
      const {
        title,
        author,
        category,
        isbn,
        publishedYear,
        pages,
        totalCopies,
        description,
      } = req.body ?? {};

      if (file) {
        const isValidPdf = verifyPdfMagicBytes(file.path);
        if (!isValidPdf) {
          removeUploadedFileSafely(file.filename);
          res.status(400).json({
            error: 'Berkas yang diunggah bukan PDF yang valid (header %PDF- tidak ditemukan).',
          });
          return;
        }
      }

      const cleanTitle = typeof title === 'string' ? title.trim() : '';
      const cleanAuthor = typeof author === 'string' ? author.trim() : '';
      const cleanCategory = typeof category === 'string' ? category.trim() : 'Teknologi';
      const cleanIsbn =
        typeof isbn === 'string' && isbn.trim()
          ? isbn.trim()
          : `978-623-${crypto.randomInt(100, 999)}-${crypto.randomInt(100, 999)}-0`;
      const cleanDesc =
        typeof description === 'string' && description.trim()
          ? description.trim()
          : 'Koleksi literasi digital yang tersedia untuk peminjaman daring dan pembacaan berkas PDF.';

      if (cleanTitle.length < 2 || cleanAuthor.length < 2) {
        if (file) removeUploadedFileSafely(file.filename);
        res.status(400).json({ error: 'Judul buku dan nama penulis wajib diisi.' });
        return;
      }

      const yearNum = Math.min(2030, Math.max(1950, Number(publishedYear) || 2026));
      const pagesNum = Math.min(5000, Math.max(1, Number(pages) || 180));
      const copiesNum = Math.min(500, Math.max(1, Number(totalCopies) || 5));
      const id = generateId('bk');
      const nowIso = new Date().toISOString();

      db.prepare(
        `INSERT INTO books (
           id, title, author, category, isbn, published_year, pages,
           total_copies, available_copies, description, cover_url,
           pdf_filename, pdf_original_name, pdf_size_bytes, uploaded_by, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
      ).run(
        id,
        cleanTitle,
        cleanAuthor,
        cleanCategory,
        cleanIsbn,
        yearNum,
        pagesNum,
        copiesNum,
        copiesNum,
        cleanDesc,
        file ? file.filename : null,
        file ? file.originalname : null,
        file ? file.size : 0,
        req.user!.name,
        nowIso
      );

      // Broadcast new collection notification to all members
      const members = db
        .prepare("SELECT id FROM users WHERE role = 'member'")
        .all() as Array<{ id: string }>;
      const insertNotif = db.prepare(
        `INSERT INTO notifications (id, user_id, loan_id, book_id, type, title, message, is_read, created_at)
         VALUES (?, ?, NULL, ?, 'new_book', ?, ?, 0, ?)`
      );
      for (const m of members) {
        insertNotif.run(
          generateId('ntf'),
          m.id,
          id,
          'Koleksi Literasi Baru Tersedia',
          `Admin baru saja menambahkan "${cleanTitle}" (${cleanCategory})${
            file ? ' lengkap dengan berkas PDF' : ''
          }.`,
          nowIso
        );
      }

      res.status(201).json({
        id,
        message: `Koleksi "${cleanTitle}" berhasil ditambahkan${
          file ? ' beserta berkas PDF.' : '.'
        }`,
      });
    });
  }
);

app.delete(
  '/api/admin/books/:id',
  requireAuth,
  requireAdmin,
  (req: AuthenticatedRequest, res) => {
    const bookId = String(req.params.id || '').trim();
    const book = db
      .prepare('SELECT id, title, pdf_filename FROM books WHERE id = ?')
      .get(bookId) as { id: string; title: string; pdf_filename: string | null } | undefined;

    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    const activeLoan = db
      .prepare(
        "SELECT id FROM loans WHERE book_id = ? AND status IN ('borrowed', 'overdue')"
      )
      .get(book.id);
    if (activeLoan) {
      res.status(409).json({
        error: 'Buku tidak dapat dihapus karena masih ada anggota yang meminjamnya.',
      });
      return;
    }

    db.prepare('DELETE FROM books WHERE id = ?').run(book.id);
    removeUploadedFileSafely(book.pdf_filename);

    res.json({ message: `Koleksi "${book.title}" telah dihapus.` });
  }
);

app.get('/api/admin/loans', requireAuth, requireAdmin, (_req, res) => {
  runDueNotificationSweep();
  const rows = db
    .prepare(
      `SELECT l.id, l.book_id, l.user_id, l.borrowed_at, l.due_at, l.returned_at, l.status,
              l.reminder_sent_h2, l.reminder_sent_overdue,
              b.title as book_title, b.category as book_category,
              u.name as member_name, u.email as member_email, u.member_code as member_code
       FROM loans l
       JOIN books b ON b.id = l.book_id
       JOIN users u ON u.id = l.user_id
       ORDER BY
         CASE l.status WHEN 'overdue' THEN 0 WHEN 'borrowed' THEN 1 ELSE 2 END,
         l.due_at ASC`
    )
    .all();

  const recentNotifications = db
    .prepare(
      `SELECT n.id, n.type, n.title, n.message, n.created_at, u.name as member_name, u.member_code
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       WHERE n.type IN ('due_soon', 'overdue')
       ORDER BY n.created_at DESC
       LIMIT 25`
    )
    .all();

  res.json({
    loans: rows,
    reminderLogs: recentNotifications,
    reminderLeadHours: getReminderLeadHours(),
  });
});

app.post('/api/admin/notifications/sweep', requireAuth, requireAdmin, (_req, res) => {
  const summary = runDueNotificationSweep();
  res.json({
    summary,
    message: `Pemeriksaan selesai: ${summary.dueSoonCreated} pengingat jatuh tempo & ${summary.overdueCreated} peringatan terlambat dikirim.`,
  });
});

app.put('/api/admin/settings', requireAuth, requireAdmin, (req, res) => {
  const { reminderLeadHours } = req.body ?? {};
  const hours = Number(reminderLeadHours);
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
    res.status(400).json({ error: 'Jeda pengingat harus antara 1 hingga 168 jam.' });
    return;
  }

  db.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('reminder_lead_hours', ?)"
  ).run(String(Math.round(hours)));

  const summary = runDueNotificationSweep();
  res.json({
    reminderLeadHours: Math.round(hours),
    summary,
    message: `Pengaturan pengingat otomatis diperbarui ke ${Math.round(
      hours
    )} jam sebelum tenggat.`,
  });
});

// ==================== SERVER & VITE ====================

async function startServer(): Promise<void> {
  runDueNotificationSweep();
  setInterval(() => {
    try {
      runDueNotificationSweep();
    } catch (err) {
      console.error('Notification sweep error:', err);
    }
  }, 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lentera Pustaka server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
