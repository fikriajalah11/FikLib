import { DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  FileText,
  FileUp,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiRequest } from '../api';
import type { AdminLoan, Book, ReminderLog } from '../types';

interface AdminConsoleViewProps {
  books: Book[];
  token: string;
  onRefreshAll: () => void;
  onOpenPdf: (bookId: string, title: string) => void;
  onNotifyToast: (msg: string, tone?: 'success' | 'error') => void;
}

const CATEGORIES = [
  'Teknologi',
  'Sejarah & Sastra',
  'Desain',
  'Ekonomi',
  'Sains',
];

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminConsoleView({
  books,
  token,
  onRefreshAll,
  onOpenPdf,
  onNotifyToast,
}: AdminConsoleViewProps) {
  const [subTab, setSubTab] = useState<'upload' | 'loans' | 'reminders'>('upload');

  // Upload PDF Form State
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Teknologi');
  const [isbn, setIsbn] = useState('');
  const [publishedYear, setPublishedYear] = useState('2026');
  const [pages, setPages] = useState('240');
  const [totalCopies, setTotalCopies] = useState('5');
  const [description, setDescription] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Admin Loans & Reminders State
  const [adminLoans, setAdminLoans] = useState<AdminLoan[]>([]);
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>([]);
  const [leadHours, setLeadHours] = useState<number>(48);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const loadAdminLoans = async () => {
    setLoadingAdminData(true);
    try {
      const res = await apiRequest<{
        loans: AdminLoan[];
        reminderLogs: ReminderLog[];
        reminderLeadHours: number;
      }>('/api/admin/loans', { token });
      setAdminLoans(res.loans);
      setReminderLogs(res.reminderLogs);
      setLeadHours(res.reminderLeadHours);
    } catch (err) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Gagal memuat data admin.',
        'error'
      );
    } finally {
      setLoadingAdminData(false);
    }
  };

  useEffect(() => {
    loadAdminLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectedFile = (file: File | null) => {
    if (!file) return;
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      onNotifyToast('Hanya berkas berformat PDF (.pdf) yang diperbolehkan.', 'error');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      onNotifyToast('Ukuran maksimal berkas PDF adalah 25 MB.', 'error');
      return;
    }
    setPdfFile(file);
    if (!title.trim()) {
      const cleaned = file.name
        .replace(/\.pdf$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim();
      setTitle(cleaned);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    handleSelectedFile(file);
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      onNotifyToast('Pilih atau seret berkas PDF terlebih dahulu.', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('title', title.trim());
      formData.append('author', author.trim());
      formData.append('category', category);
      formData.append('isbn', isbn.trim());
      formData.append('publishedYear', publishedYear);
      formData.append('pages', pages);
      formData.append('totalCopies', totalCopies);
      formData.append('description', description.trim());

      const res = await apiRequest<{ message: string }>('/api/admin/books', {
        method: 'POST',
        token,
        body: formData,
        isFormData: true,
      });

      onNotifyToast(res.message, 'success');
      setTitle('');
      setAuthor('');
      setIsbn('');
      setDescription('');
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onRefreshAll();
    } catch (err) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Gagal mengunggah koleksi PDF.',
        'error'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBook = async (bookId: string, bookTitle: string) => {
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/admin/books/${encodeURIComponent(bookId)}`,
        { method: 'DELETE', token }
      );
      onNotifyToast(res.message, 'success');
      onRefreshAll();
    } catch (err) {
      onNotifyToast(
        err instanceof Error
          ? err.message
          : `Gagal menghapus "${bookTitle}".`,
        'error'
      );
    }
  };

  const handleAdminReturnLoan = async (loanId: string) => {
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/loans/${encodeURIComponent(loanId)}/return`,
        { method: 'POST', token }
      );
      onNotifyToast(res.message, 'success');
      loadAdminLoans();
      onRefreshAll();
    } catch (err) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Gagal mengembalikan buku.',
        'error'
      );
    }
  };

  const handleRunSweep = async () => {
    setSweeping(true);
    try {
      const res = await apiRequest<{ message: string }>(
        '/api/admin/notifications/sweep',
        { method: 'POST', token }
      );
      onNotifyToast(res.message, 'success');
      loadAdminLoans();
      onRefreshAll();
    } catch (err) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Gagal menjalankan pengingat.',
        'error'
      );
    } finally {
      setSweeping(false);
    }
  };

  const handleUpdateLeadHours = async (hours: number) => {
    setLeadHours(hours);
    try {
      const res = await apiRequest<{ message: string }>('/api/admin/settings', {
        method: 'PUT',
        token,
        body: { reminderLeadHours: hours },
      });
      onNotifyToast(res.message, 'success');
      loadAdminLoans();
    } catch (err) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Gagal memperbarui pengaturan.',
        'error'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Panel Pengelola & Unggah PDF
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Tambahkan koleksi literasi PDF baru, pantau sirkulasi anggota, dan kelola jadwal notifikasi pengingat otomatis.
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1 sm:self-auto">
          {[
            { id: 'upload', label: 'Unggah PDF & Koleksi' },
            { id: 'loans', label: 'Monitor Pinjaman' },
            { id: 'reminders', label: 'Pengingat Otomatis' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as 'upload' | 'loans' | 'reminders')}
              className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                subTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab 1: PDF Upload & Collection Management */}
      {subTab === 'upload' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Upload Form */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Tambah Koleksi Literasi (PDF)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Unggah dokumen PDF (maksimal 25 MB). Anggota langsung menerima notifikasi koleksi baru setelah disimpan.
            </p>

            <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
              {/* Drag & Drop PDF Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                  isDragging
                    ? 'border-teal-700 bg-teal-50/70'
                    : pdfFile
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-300 bg-slate-50 hover:border-teal-600'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) =>
                    handleSelectedFile(e.target.files?.[0] || null)
                  }
                />
                <FileUp className="mx-auto h-7 w-7 text-teal-700" />
                {pdfFile ? (
                  <div className="mt-2">
                    <p className="truncate text-xs font-semibold text-slate-900">
                      {pdfFile.name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-emerald-700">
                      Siap diunggah · {formatBytes(pdfFile.size)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-slate-800">
                      Seret berkas PDF ke sini atau klik untuk memilih
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Format .pdf hingga 25 MB
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="book-title"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Judul Buku / Dokumen
                </label>
                <input
                  id="book-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Pengantar Kecerdasan Buatan Terapan"
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="book-author"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Penulis
                  </label>
                  <input
                    id="book-author"
                    type="text"
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Nama penulis"
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="book-category"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Kategori
                  </label>
                  <select
                    id="book-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-teal-700 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="book-year"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Tahun
                  </label>
                  <input
                    id="book-year"
                    type="number"
                    min={1950}
                    max={2030}
                    value={publishedYear}
                    onChange={(e) => setPublishedYear(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="book-pages"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Halaman
                  </label>
                  <input
                    id="book-pages"
                    type="number"
                    min={1}
                    value={pages}
                    onChange={(e) => setPages(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="book-copies"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Salinan
                  </label>
                  <input
                    id="book-copies"
                    type="number"
                    min={1}
                    max={500}
                    value={totalCopies}
                    onChange={(e) => setTotalCopies(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="book-isbn"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  ISBN (Opsional)
                </label>
                <input
                  id="book-isbn"
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="978-623-xxx-xxx-x"
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="book-desc"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Ringkasan / Deskripsi
                </label>
                <textarea
                  id="book-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ringkasan singkat isi buku untuk membantu anggota memilih bacaan..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-teal-700 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                <span>
                  {uploading ? 'Mengunggah PDF...' : 'Simpan & Terbitkan Koleksi'}
                </span>
              </button>
            </form>
          </section>

          {/* Existing Collections Table */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-7">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Daftar Koleksi Terunggah
                </h2>
                <p className="text-xs text-slate-500">
                  Pratinjau dokumen PDF atau hapus koleksi yang tidak sedang dipinjam
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-600">
                {books.length} judul
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="px-5 py-3">Koleksi</th>
                    <th className="px-4 py-3">PDF</th>
                    <th className="px-4 py-3 text-right">Stok</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {books.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{b.title}</p>
                        <p className="text-xs text-slate-500">
                          {b.author} · {b.category}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                        {b.has_pdf ? formatBytes(b.pdf_size_bytes) : 'Tidak ada'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums text-slate-700">
                        {b.available_copies}/{b.total_copies}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {b.has_pdf && (
                            <button
                              type="button"
                              onClick={() => onOpenPdf(b.id, b.title)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <FileText className="h-3.5 w-3.5 text-teal-700" />
                              <span>Baca</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteBook(b.id, b.title)}
                            aria-label={`Hapus ${b.title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Sub-tab 2: Monitor Member Loans */}
      {subTab === 'loans' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Pemantauan Peminjaman Anggota
              </h2>
              <p className="text-xs text-slate-500">
                Daftar seluruh transaksi peminjaman aktif, terlambat, dan riwayat pengembalian anggota
              </p>
            </div>
            <button
              type="button"
              onClick={loadAdminLoans}
              className="inline-flex min-h-[38px] items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 sm:self-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Muat Ulang</span>
            </button>
          </div>

          {loadingAdminData ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Memuat data peminjaman anggota...
            </div>
          ) : adminLoans.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Belum ada transaksi peminjaman dari anggota.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="px-5 py-3">Anggota</th>
                    <th className="px-4 py-3">Judul Buku</th>
                    <th className="px-4 py-3">Batas Pengembalian</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {adminLoans.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{l.member_name}</p>
                        <p className="font-mono text-xs text-slate-500">
                          {l.member_code} · {l.member_email}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-900">{l.book_title}</p>
                        <p className="text-xs text-slate-500">{l.book_category}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-700">
                        {new Date(l.due_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold">
                        {l.status === 'overdue' && (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Terlambat
                          </span>
                        )}
                        {l.status === 'borrowed' && (
                          <span className="text-amber-700">Sedang Dipinjam</span>
                        )}
                        {l.status === 'returned' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Dikembalikan
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {l.status !== 'returned' ? (
                          <button
                            type="button"
                            onClick={() => handleAdminReturnLoan(l.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Konfirmasi Kembali</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Selesai</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Sub-tab 3: Automated Due-Date Reminders */}
      {subTab === 'reminders' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <BellRing className="h-5 w-5 text-teal-700" />
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Konfigurasi Pengingat Otomatis
              </h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Sistem memeriksa tenggat peminjaman setiap 60 detik secara otomatis dan mengirimkan notifikasi pengingat ke akun anggota sebelum batas waktu berakhir.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Jeda Waktu Pengingat Sebelum Jatuh Tempo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { hours: 12, label: '12 Jam Sebelum' },
                    { hours: 24, label: '24 Jam (H-1)' },
                    { hours: 48, label: '48 Jam (H-2)' },
                    { hours: 72, label: '72 Jam (H-3)' },
                  ].map((opt) => (
                    <button
                      key={opt.hours}
                      type="button"
                      onClick={() => handleUpdateLeadHours(opt.hours)}
                      className={`min-h-[40px] rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        leadHours === opt.hours
                          ? 'border-teal-700 bg-teal-50 text-teal-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={sweeping}
                  onClick={handleRunSweep}
                  className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${sweeping ? 'animate-spin' : ''}`} />
                  <span>
                    {sweeping
                      ? 'Memeriksa Tenggat...'
                      : 'Jalankan Pemeriksaan Pengingat Sekarang'}
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-7">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Riwayat Pengingat Terkirim
              </h2>
              <p className="text-xs text-slate-500">
                Notifikasi otomatis jatuh tempo & keterlambatan yang dikirim ke anggota
              </p>
            </div>

            {reminderLogs.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Belum ada pengingat tenggat yang terkirim. Pengingat otomatis akan tercatat saat ada pinjaman mendekati batas pengembalian.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {reminderLogs.map((log) => (
                  <div key={log.id} className="p-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        {log.member_name} ·{' '}
                        <span className="font-mono text-slate-500">
                          {log.member_code}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {new Date(log.created_at).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-xs font-semibold ${
                        log.type === 'overdue' ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      {log.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
