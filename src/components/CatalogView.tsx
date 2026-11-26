import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { apiRequest, fetchPdfBlobUrl } from '../api';
import type { Book, UserRole } from '../types';

interface CatalogViewProps {
  books: Book[];
  loading: boolean;
  token: string;
  role: UserRole;
  onRefresh: () => void;
  onOpenPdf: (bookId: string, title: string) => void;
  onNotifyToast: (msg: string, tone?: 'success' | 'error') => void;
}

const CATEGORIES = [
  'Semua',
  'Teknologi',
  'Sejarah & Sastra',
  'Desain',
  'Ekonomi',
  'Sains',
];

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CatalogView({
  books,
  loading,
  token,
  role,
  onRefresh,
  onOpenPdf,
  onNotifyToast,
}: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [onlyPdf, setOnlyPdf] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [loanDays, setLoanDays] = useState<number>(7);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredBooks = books.filter((b) => {
    if (selectedCategory !== 'Semua' && b.category !== selectedCategory) {
      return false;
    }
    if (onlyPdf && !b.has_pdf) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${b.title} ${b.author} ${b.isbn} ${b.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const handleBorrow = async (book: Book) => {
    setBusyId(book.id);
    try {
      const res = await apiRequest<{ message: string }>('/api/loans', {
        method: 'POST',
        token,
        body: { bookId: book.id, durationDays: loanDays },
      });
      onNotifyToast(res.message, 'success');
      setSelectedBook(null);
      onRefresh();
    } catch (err) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Gagal meminjam buku.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleReturn = async (loanId: string) => {
    setBusyId(loanId);
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/loans/${encodeURIComponent(loanId)}/return`,
        {
          method: 'POST',
          token,
        }
      );
      onNotifyToast(res.message, 'success');
      setSelectedBook(null);
      onRefresh();
    } catch (err) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Gagal mengembalikan buku.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadPdf = async (book: Book) => {
    try {
      const url = await fetchPdfBlobUrl(book.id, token, true);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Gagal mengunduh PDF.',
        'error'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Katalog Koleksi Literasi
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pinjam buku secara daring, baca dokumen PDF langsung di peramban, dan pantau ketersediaan salinan.
          </p>
        </div>

        <p className="font-mono text-xs tabular-nums text-slate-500">
          Menampilkan {filteredBooks.length} dari {books.length} judul
        </p>
      </div>

      {/* Search and Category Filter Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul buku, penulis, atau ISBN..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyPdf(!onlyPdf)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              onlyPdf
                ? 'border-teal-700 bg-teal-50 text-teal-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Tersedia PDF</span>
          </button>
        </div>
      </div>

      {/* Book Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
            Koleksi tidak ditemukan
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ubah kata kunci pencarian atau pilih kategori lain untuk melihat koleksi yang tersedia.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedCategory('Semua');
              setOnlyPdf(false);
            }}
            className="mt-4 inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBooks.map((book) => {
            const isBorrowedByMe = Boolean(book.active_loan);
            return (
              <article
                key={book.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300"
              >
                {/* 3:4 Book Cover with Fallback */}
                <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-slate-200 bg-slate-100">
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={`Sampul buku ${book.title}`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-slate-800 via-slate-900 to-teal-950 p-5 text-white">
                      <span className="text-xs font-medium text-teal-200">
                        {book.category}
                      </span>
                      <div>
                        <p className="line-clamp-2 font-display text-lg font-semibold leading-snug text-white">
                          {book.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">{book.author}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    {/* Clean unboxed metadata */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="font-medium text-teal-700">{book.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{book.published_year}</span>
                      {book.has_pdf && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-700">PDF</span>
                        </>
                      )}
                    </div>

                    <h3 className="mt-2 line-clamp-2 font-display text-base font-semibold leading-snug text-slate-900">
                      {book.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">{book.author}</p>
                    <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {book.description}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <span className="font-mono tabular-nums text-slate-600">
                        Tersedia {book.available_copies}/{book.total_copies}
                      </span>
                      {isBorrowedByMe ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Sedang Dipinjam
                        </span>
                      ) : book.available_copies === 0 ? (
                        <span className="font-semibold text-red-700">Stok Habis</span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBook(book)}
                        className={`flex min-h-[40px] flex-1 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                          isBorrowedByMe
                            ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                            : 'bg-teal-700 text-white hover:bg-teal-800'
                        }`}
                      >
                        {isBorrowedByMe ? 'Kelola Pinjaman' : 'Detail & Pinjam'}
                      </button>

                      {book.has_pdf && (isBorrowedByMe || role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => onOpenPdf(book.id, book.title)}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <FileText className="h-3.5 w-3.5 text-teal-700" />
                          <span>Baca</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Book Detail & Borrow Modal */}
      {selectedBook && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-medium text-teal-700">
                  {selectedBook.category} · {selectedBook.published_year} ·{' '}
                  {selectedBook.pages} halaman
                </p>
                <h2
                  id="book-modal-title"
                  className="mt-1 font-display text-xl font-semibold text-slate-900"
                >
                  {selectedBook.title}
                </h2>
                <p className="mt-0.5 text-sm text-slate-600">{selectedBook.author}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                aria-label="Tutup detail buku"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-slate-700">
                {selectedBook.description}
              </p>

              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">ISBN</dt>
                  <dd className="mt-0.5 font-mono font-medium text-slate-900">
                    {selectedBook.isbn}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Kuota Salinan</dt>
                  <dd className="mt-0.5 font-mono font-medium tabular-nums text-slate-900">
                    {selectedBook.available_copies} / {selectedBook.total_copies} tersedia
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Berkas Digital</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {selectedBook.has_pdf
                      ? `PDF (${formatBytes(selectedBook.pdf_size_bytes)})`
                      : 'Tidak ada PDF'}
                  </dd>
                </div>
              </dl>

              {selectedBook.active_loan ? (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-emerald-900">
                      Anda sedang meminjam buku ini
                    </p>
                    <span className="font-mono text-xs tabular-nums text-emerald-800">
                      Tenggat:{' '}
                      {new Date(selectedBook.active_loan.due_at).toLocaleDateString(
                        'id-ID',
                        { day: 'numeric', month: 'short', year: 'numeric' }
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedBook.has_pdf && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedBook;
                            setSelectedBook(null);
                            onOpenPdf(target.id, target.title);
                          }}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Baca PDF Daring</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(selectedBook)}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <Download className="h-4 w-4" />
                          <span>Unduh PDF</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={busyId === selectedBook.active_loan.id}
                      onClick={() => handleReturn(selectedBook.active_loan!.id)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Kembalikan Buku</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Pilih Durasi Peminjaman
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { days: 1, label: '1 Hari (Cepat)' },
                        { days: 3, label: '3 Hari' },
                        { days: 7, label: '7 Hari' },
                        { days: 14, label: '14 Hari' },
                      ].map((opt) => (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => setLoanDays(opt.days)}
                          className={`min-h-[40px] rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                            loanDays === opt.days
                              ? 'border-teal-700 bg-teal-50 text-teal-800'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Sistem notifikasi otomatis akan mengirimkan pengingat batas waktu sebelum tenggat berakhir.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    {role === 'admin' && selectedBook.has_pdf && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = selectedBook;
                          setSelectedBook(null);
                          onOpenPdf(target.id, target.title);
                        }}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <FileText className="h-4 w-4 text-teal-700" />
                        <span>Pratinjau PDF Admin</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={
                        selectedBook.available_copies <= 0 || busyId === selectedBook.id
                      }
                      onClick={() => handleBorrow(selectedBook)}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-teal-700 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>
                        {busyId === selectedBook.id
                          ? 'Memproses...'
                          : selectedBook.available_copies <= 0
                          ? 'Stok Sedang Habis'
                          : `Pinjam Buku (${loanDays} Hari)`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
