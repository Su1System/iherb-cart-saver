import unittest,tempfile,sys,sqlite3
from pathlib import Path
from datetime import datetime,timezone,timedelta
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from reader_budget import ReaderBudget,REQUEST_TOKENS
from reader_source import ReaderSource
from update_offers import SOURCES

class Tests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory();self.addCleanup(self.folder.cleanup)
        self.path=Path(self.folder.name)/'budget.sqlite';self.now=datetime(2026,10,28,tzinfo=timezone.utc)
    def test_concurrent_calls_and_new_process_objects_cannot_reset_daily_cap(self):
        def reserve(_):
            try:ReaderBudget(self.path).reserve('AU',self.now);return True
            except ValueError:return False
        with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(reserve,range(20)))
        self.assertEqual(sum(results),12)
        self.assertFalse(reserve(0))
        self.assertEqual(ReaderBudget(self.path).reserve('AU',self.now+timedelta(days=1)),REQUEST_TOKENS)
    def test_monthly_limit_blocks_before_network(self):
        budget=ReaderBudget(self.path);budget.reserve(SOURCES['AU'])
        with sqlite3.connect(self.path) as db:db.execute('UPDATE calls SET reserved=20000000')
        def never(*a,**kw):self.fail('Paid network request reached after cap')
        with self.assertRaisesRegex(ValueError,'MONTHLY_BUDGET'):ReaderSource('test-key',never,budget)(SOURCES['AU'])
    def test_corrupt_state_fails_closed(self):
        self.path.write_bytes(b'not a database')
        with self.assertRaisesRegex(ValueError,'STATE_UNAVAILABLE'):ReaderBudget(self.path).reserve('AU',self.now)

if __name__=='__main__':unittest.main()
