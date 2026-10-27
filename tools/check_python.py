"""Run the existing deterministic collector tests without importing live browser tests."""
from pathlib import Path
import sys, unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
suite=unittest.TestSuite()
for name in ['collector_test.py','reader_test.py','publisher_test.py','budget_test.py']:
    suite.addTests(unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern=name))
if __name__=='__main__':
    sys.exit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())
