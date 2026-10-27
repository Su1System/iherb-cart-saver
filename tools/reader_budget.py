"""Reserve the full request ceiling before network I/O, including failed calls.

At the observed US$50 / 1 billion-token top-up, 20M tokens is US$1.
This is a collector-only cap; it cannot control unrelated uses of the same key.
SQLite transactions prevent overlapping workers and restarts resetting the cap.
"""
from datetime import datetime, timezone
from pathlib import Path
import sqlite3

REQUEST_TOKENS=50_000
DAY_CALLS=12
MONTH_TOKENS=20_000_000

class ReaderBudget:
    def __init__(self,path):
        self.path=Path(path)

    def reserve(self,source,now=None):
        now=now or datetime.now(timezone.utc)
        day=now.strftime('%Y-%m-%d');month=day[:7]
        self.path.parent.mkdir(parents=True,exist_ok=True)
        try:
            with sqlite3.connect(self.path,timeout=5) as db:
                db.execute('CREATE TABLE IF NOT EXISTS calls(id INTEGER PRIMARY KEY, at TEXT NOT NULL, source TEXT NOT NULL, reserved INTEGER NOT NULL)')
                db.execute('BEGIN IMMEDIATE')
                daily=db.execute('SELECT count(*) FROM calls WHERE substr(at,1,10)=?',(day,)).fetchone()[0]
                monthly=db.execute('SELECT coalesce(sum(reserved),0) FROM calls WHERE substr(at,1,7)=?',(month,)).fetchone()[0]
                if daily>=DAY_CALLS:raise ValueError('READER_DAILY_BUDGET_REACHED')
                if monthly+REQUEST_TOKENS>MONTH_TOKENS:raise ValueError('READER_MONTHLY_BUDGET_REACHED')
                self.call_id=db.execute('INSERT INTO calls(at,source,reserved) VALUES(?,?,?)',(now.isoformat(),source,REQUEST_TOKENS)).lastrowid
        except sqlite3.Error:
            raise ValueError('READER_BUDGET_STATE_UNAVAILABLE') from None
        return REQUEST_TOKENS

    def record(self,tokens,status):
        # Reservations are never refunded, including timeouts and rejected calls.
        try:
            with sqlite3.connect(self.path,timeout=5) as db:
                db.execute('CREATE TABLE IF NOT EXISTS receipts(call_id INTEGER PRIMARY KEY, tokens INTEGER, status INTEGER NOT NULL)')
                db.execute('INSERT OR REPLACE INTO receipts VALUES(?,?,?)',(self.call_id,tokens,status))
        except sqlite3.Error:raise ValueError('READER_USAGE_STATE_UNAVAILABLE') from None
