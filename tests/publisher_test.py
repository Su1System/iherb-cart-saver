import unittest,sys,json,os,tempfile
from pathlib import Path
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import publish_offers as publisher
from update_offers import SOURCES

class Tests(unittest.TestCase):
    def test_origin_persists_fresh_data_without_publisher_token_or_remote_post(self):
        now=datetime.now(timezone.utc)
        entry={'country':'AU','source':SOURCES['AU'],'collectedAt':now.isoformat(),'expiresAt':(now+timedelta(hours=48)).isoformat(),'codes':['TEST20']}
        feed={'schema':1,'generatedAt':now.isoformat(),'regions':{'AU':entry},'status':{'AU':{'state':'ok','checkedAt':now.isoformat()}}}
        with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,{'IHERB_STATE_DIR':directory,'IHERB_PUBLISH_MODE':'origin','IHERB_SOURCE_BACKEND':'direct'},clear=True),patch.object(publisher,'collect',return_value=feed),patch.object(publisher.requests,'post') as post:
            self.assertEqual(publisher.run(),0)
            post.assert_not_called()
            self.assertEqual(json.loads((Path(directory)/'feed-state.json').read_text()),feed)
            self.assertFalse((Path(directory)/'feed-state.tmp').exists())

    def test_all_failed_sources_record_error_and_remove_expired_data_without_success(self):
        now=datetime.now(timezone.utc).isoformat()
        feed={'schema':1,'generatedAt':now,'regions':{},'status':{c:{'state':'unavailable','error':'READER_AUTH_REQUIRED','checkedAt':now} for c in SOURCES}}
        with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,{'IHERB_STATE_DIR':directory,'IHERB_PUBLISH_MODE':'origin','IHERB_SOURCE_BACKEND':'direct'},clear=True),patch.object(publisher,'collect',return_value=feed):
            self.assertEqual(publisher.run(),2)
            self.assertEqual(json.loads((Path(directory)/'feed-state.json').read_text())['regions'],{})
            self.assertEqual(json.loads((Path(directory)/'publisher-state.json').read_text())['regions']['AU']['error'],'READER_AUTH_REQUIRED')

    def test_retained_records_keep_original_collection_time_and_are_not_fresh_success(self):
        now=datetime.now(timezone.utc);old=(now-timedelta(hours=6)).isoformat()
        entry={'country':'SG','source':SOURCES['SG'],'collectedAt':old,'expiresAt':(now+timedelta(hours=42)).isoformat(),'codes':['TEST20']}
        feed={'schema':1,'generatedAt':now.isoformat(),'regions':{'SG':entry},'status':{'SG':{'state':'retained','checkedAt':now.isoformat(),'error':'READER_HTTP_401'}}}
        with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,{'IHERB_STATE_DIR':directory,'IHERB_PUBLISH_MODE':'origin','IHERB_SOURCE_BACKEND':'direct'},clear=True),patch.object(publisher,'collect',return_value=feed):
            self.assertEqual(publisher.run(),2)
            self.assertEqual(json.loads((Path(directory)/'feed-state.json').read_text())['regions']['SG']['collectedAt'],old)

if __name__=='__main__':unittest.main()
