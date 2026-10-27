import unittest,sys,json,tempfile,os
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from reader_source import ReaderSource
from update_offers import collect,SOURCES

class Reply:
    def __init__(self,source,body,status=200):
        self.status_code=status
        self.data={'data':{'url':source,'html':body}}
        self.content=json.dumps(self.data).encode()
    def json(self):return self.data

class Tests(unittest.TestCase):
    def setUp(self):
        self.state=tempfile.TemporaryDirectory();self.addCleanup(self.state.cleanup)
        self.env=patch.dict(os.environ,{'IHERB_STATE_DIR':self.state.name});self.env.start();self.addCleanup(self.env.stop)
    def test_auth_scoped_to_reader_no_cookies_and_fresh_html_reuses_country_parser(self):
        def get(url,headers,**kw):
            self.assertTrue(url.startswith('https://r.jina.ai/https://'))
            self.assertEqual(headers['Authorization'],'Bearer test-key')
            self.assertEqual(headers['X-Cache-Tolerance'],'0')
            self.assertEqual(headers['X-Robots-Txt'],'*')
            self.assertEqual(headers['X-Token-Budget'],'50000')
            self.assertFalse(kw['allow_redirects'])
            source=url[len('https://r.jina.ai/'):];country=next(k for k,v in SOURCES.items() if v==source)
            return Reply(source,f'<html><button class="selected-country-wrapper">{country}</button><a href="{source}?pcode=TEST20">Offer</a></html>')
        result=collect(get=ReaderSource('test-key',get))
        self.assertEqual(set(result['regions']),{'AU','US','SG'})
    def test_redirect_challenge_auth_failure_and_non_html_do_not_become_offers(self):
        for response in [Reply('https://example.com','<html/>'),Reply(SOURCES['AU'],'<html><title>Just a moment</title></html>'),Reply(SOURCES['AU'],'oops',401),Reply(SOURCES['AU'],'# Markdown')]:
            self.assertFalse(collect(get=ReaderSource('test-key',lambda *a,**k:response))['regions'])
    def test_missing_key_and_unknown_target_fail_before_network(self):
        def never(*a,**kw):self.fail('network used')
        with self.assertRaises(ValueError):ReaderSource('',never)(SOURCES['AU'])
        with self.assertRaises(ValueError):ReaderSource('test-key',never)('https://unknown.example')

if __name__=='__main__':unittest.main()
