export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    isFormData?: boolean;
  } = {}
): Promise<T> {
  const { method = 'GET', token, body, isFormData = false } = options;
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: isFormData
      ? (body as FormData)
      : body !== undefined
      ? JSON.stringify(body)
      : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Permintaan gagal (${res.status})`,
      res.status
    );
  }

  return data as T;
}

export async function fetchPdfBlobUrl(
  bookId: string,
  token: string,
  download = false
): Promise<string> {
  const url = `/api/books/${encodeURIComponent(bookId)}/pdf${
    download ? '?download=1' : ''
  }`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let message = 'Gagal memuat berkas PDF.';
    try {
      const errData = await res.json();
      if (errData?.error) message = errData.error;
    } catch {
      // ignore non-json
    }
    throw new ApiError(message, res.status);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
