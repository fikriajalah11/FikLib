import { useEffect, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { fetchPdfBlobUrl } from '../api';

interface PdfReaderModalProps {
  bookId: string;
  bookTitle: string;
  token: string;
  onClose: () => void;
}

export function PdfReaderModal({
  bookId,
  bookTitle,
  token,
  onClose,
}: PdfReaderModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    setLoading(true);
    setError(null);

    fetchPdfBlobUrl(bookId, token, false)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setBlobUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Gagal membuka PDF.');
        setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [bookId, token]);

  const handleDownload = async () => {
    try {
      const url = await fetchPdfBlobUrl(bookId, token, true);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunduh PDF.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-reader-title"
    >
      <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-teal-700" />
            <h2
              id="pdf-reader-title"
              className="truncate font-display text-base font-semibold text-slate-900 sm:text-lg"
            >
              {bookTitle}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Unduh PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pembaca PDF"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-slate-100">
          {loading && (
            <div className="flex h-full items-center justify-center p-8 text-sm text-slate-600">
              Memuat dokumen PDF secara aman...
            </div>
          )}

          {!loading && error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="max-w-md text-sm font-medium text-red-700">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white"
              >
                Tutup
              </button>
            </div>
          )}

          {!loading && !error && blobUrl && (
            <iframe
              src={blobUrl}
              title={`Pembaca PDF ${bookTitle}`}
              className="h-full w-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
