import { db, generateId } from './db.ts';

export interface SweepSummary {
  checkedActiveLoans: number;
  dueSoonCreated: number;
  overdueCreated: number;
  ranAt: string;
}

interface ActiveLoanRow {
  id: string;
  book_id: string;
  user_id: string;
  due_at: string;
  status: string;
  reminder_sent_h2: number;
  reminder_sent_overdue: number;
  book_title: string;
}

export function getReminderLeadHours(): number {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'reminder_lead_hours'")
    .get() as { value: string } | undefined;
  const parsed = row ? Number(row.value) : 48;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 168 ? parsed : 48;
}

export function runDueNotificationSweep(): SweepSummary {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const leadHours = getReminderLeadHours();
  const leadMs = leadHours * 60 * 60 * 1000;

  const activeLoans = db
    .prepare(
      `SELECT l.id, l.book_id, l.user_id, l.due_at, l.status,
              l.reminder_sent_h2, l.reminder_sent_overdue, b.title as book_title
       FROM loans l
       JOIN books b ON b.id = l.book_id
       WHERE l.status IN ('borrowed', 'overdue')`
    )
    .all() as ActiveLoanRow[];

  let dueSoonCreated = 0;
  let overdueCreated = 0;

  const markOverdueStmt = db.prepare(
    "UPDATE loans SET status = 'overdue', reminder_sent_overdue = 1 WHERE id = ?"
  );
  const markOverdueStatusOnlyStmt = db.prepare(
    "UPDATE loans SET status = 'overdue' WHERE id = ?"
  );
  const markDueSoonStmt = db.prepare(
    'UPDATE loans SET reminder_sent_h2 = 1 WHERE id = ?'
  );
  const insertNotifStmt = db.prepare(`
    INSERT INTO notifications (id, user_id, loan_id, book_id, type, title, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  const runTx = db.transaction(() => {
    for (const loan of activeLoans) {
      const dueMs = new Date(loan.due_at).getTime();
      const remainingMs = dueMs - now;

      if (remainingMs <= 0) {
        if (loan.status !== 'overdue') {
          markOverdueStatusOnlyStmt.run(loan.id);
        }
        if (!loan.reminder_sent_overdue) {
          markOverdueStmt.run(loan.id);
          insertNotifStmt.run(
            generateId('ntf'),
            loan.user_id,
            loan.id,
            loan.book_id,
            'overdue',
            'Batas Waktu Pengembalian Terlewati',
            `Buku "${loan.book_title}" telah melewati tenggat pengembalian. Segera lakukan pengembalian daring agar akun Anda tetap aktif.`,
            nowIso
          );
          overdueCreated += 1;
        }
      } else if (remainingMs <= leadMs && !loan.reminder_sent_h2) {
        const hoursLeft = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60)));
        const timeText =
          hoursLeft >= 24
            ? `${Math.ceil(hoursLeft / 24)} hari`
            : `${hoursLeft} jam`;
        markDueSoonStmt.run(loan.id);
        insertNotifStmt.run(
          generateId('ntf'),
          loan.user_id,
          loan.id,
          loan.book_id,
          'due_soon',
          'Pengingat Batas Waktu Pengembalian',
          `Pengingat otomatis: buku "${loan.book_title}" akan jatuh tempo dalam ${timeText}. Silakan selesaikan bacaan atau kembalikan tepat waktu.`,
          nowIso
        );
        dueSoonCreated += 1;
      }
    }

    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sweep_at', ?)"
    ).run(nowIso);
  });

  runTx();

  return {
    checkedActiveLoans: activeLoans.length,
    dueSoonCreated,
    overdueCreated,
    ranAt: nowIso,
  };
}
