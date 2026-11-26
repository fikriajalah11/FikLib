import { useState } from 'react';
import {
  AlertCircle,
  BookCheck,
  CalendarPlus,
  Clock,
  Download,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { apiRequest, fetchPdfBlobUrl } from '../api';
import type { Loan } from '../types';

interface LoansViewProps {
  loans: Loan[];
  loading: boolean;
  token: string;
  onRefresh: () => void;
  onOpenPdf: (bookId: string, title: string) => void;
  onGoToCatalog: () => void;
  onNotifyToast: (msg: string, tone?: 'success' | 'error') => void;
}

function getDueSummary(loan: Loan): {
  label: string;
  tone: 'neutral' | 'warning' | 'danger' | 'success';
} {
  if (loan.status === 'returned') {
    return {
      label: `Dikembalikan ${
        loan.returned_at
          ? new Date(loan.returned_at).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : ''
      }`,
      tone: 'success',
    };
  }

  const diffMs = new Date(loan.due_at).getTime() - Date.now();
  if (diffMs <= 0 || loan.status === 'overdue') {
    const daysLate = Math.max(1, Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
    return { label: `Terlambat ${daysLate} hari`, tone: 'danger' };
  }

  const hoursLeft = Math.ceil(diffMs / (1000 * 60 * 60));
  if (hoursLeft <= 48) {
    return {
      label:
        hoursLeft >= 24
          ? `Jatuh tempo dalam ${Math.ceil(hoursLeft / 24)} hari`
          : `Jatuh tempo dalam ${hoursLeft} jam`,
      tone: 'warning',
    };
  }

  const daysLeft = Math.ceil(hoursLeft / 24);
  return { label: `Sisa waktu ${daysLeft} hari`, tone: 'neutral' };
}

export function LoansView({
  loans,
  loading,
  token,
  onRefresh,
  onOpenPdf,
  onGoToCatalog,
  onNotifyToast,
}: LoansViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'returned'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const visibleLoans = loans.filter((l) => {
    if (filter === 'active') return l.status !== 'returned';
    if (filter === 'returned') return l.status === 'returned';
    return true;
  });

  const handleReturn = async (loanId: string) => {
    setBusyId(loanId);
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/loans/${encodeURIComponent(loanId)}/return`,
        { method: 'POST', token }
      );
      onNotifyToast(res.message, 'success');
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

  const handleExtend = async (loanId: string) => {
    setBusyId(loanId);
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/loans/${encodeURIComponent(loanId)}/extend`,
        { method: 'POST', token }
      );
      onNotifyToast(res.message, 'success');
      onRefresh();
    } catch (err) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Gagal memperpanjang durasi.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (bookId: string, title: string) => {
    try {
      const url = await fetchPdfBlobUrl(bookId, token, true);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
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
            Pinjaman & Pengembalian Saya
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Kelola buku yang sedang Anda pinjam, baca berkas PDF, perpanjang durasi, atau lakukan pengembalian daring.
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1 sm:self-auto">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'active', label: 'Aktif' },
            { id: 'returned', label: 'Riwayat Selesai' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as 'all' | 'active' | 'returned')}
              className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : visibleLoans.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <BookCheck className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
            Belum ada catatan peminjaman
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Pilih buku dari katalog koleksi untuk mulai meminjam dan membaca secara daring.
          </p>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="mt-4 inline-flex min-h-[40px] items-center rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            Buka Katalog Buku
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {visibleLoans.map((loan) => {
            const summary = getDueSummary(loan);
            const isReturned = loan.status === 'returned';

            return (
              <div
                key={loan.id}
                className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-teal-700">
                      {loan.book_category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Dipinjam{' '}
                      {new Date(loan.borrowed_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Tenggat{' '}
                      {new Date(loan.due_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {loan.book_title}
                  </h3>
                  <p className="text-xs text-slate-600">{loan.book_author}</p>

                  <div className="flex items-center gap-1.5 pt-0.5 text-xs font-semibold">
                    {summary.tone === 'danger' && (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-red-700">{summary.label}</span>
                      </>
                    )}
                    {summary.tone === 'warning' && (
                      <>
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span className="text-amber-700">{summary.label}</span>
                      </>
                    )}
                    {summary.tone === 'success' && (
                      <>
                        <BookCheck className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-700">{summary.label}</span>
                      </>
                    )}
                    {summary.tone === 'neutral' && (
                      <>
                        <Clock className="h-4 w-4 text-slate-500" />
                        <span className="text-slate-700">{summary.label}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap shrink-0 items-center gap-2">
                  {!isReturned && loan.has_pdf && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenPdf(loan.book_id, loan.book_title)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Baca PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(loan.book_id, loan.book_title)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <Download className="h-4 w-4" />
                        <span>Unduh</span>
                      </button>
                    </>
                  )}

                  {loan.status === 'borrowed' && (
                    <button
                      type="button"
                      disabled={busyId === loan.id}
                      onClick={() => handleExtend(loan.id)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                    >
                      <CalendarPlus className="h-4 w-4" />
                      <span>+3 Hari</span>
                    </button>
                  )}

                  {!isReturned && (
                    <button
                      type="button"
                      disabled={busyId === loan.id}
                      onClick={() => handleReturn(loan.id)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Kembalikan</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
