import unittest,sys
from pathlib import Path
from datetime import datetime,timezone,timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tools.update_offers import collect,SOURCES
NOW=datetime(2026,10,28,tzinfo=timezone.utc)
class Reply:
    def __init__(self,url,country,status=200):
        self.url=url;self.status_code=status;self.headers={'content-type':'text/html'}
        self.text=f'<button class="selected-country-wrapper">{country} EN USD</button><a href="{url}?pcode=CODE20">Offer</a>'
        self.content=self.text.encode()
class Tests(unittest.TestCase):
    def test_markets_have_independent_sources(self):
        result=collect(now=NOW,get=lambda url,**_:Reply(url,next(k for k,v in SOURCES.items() if v==url)))
        self.assertEqual(set(result['regions']),set(SOURCES))
        self.assertEqual(result['regions']['AU']['codes'],['CODE20'])
    def test_redirect_and_wrong_country_do_not_leak(self):
        result=collect(now=NOW,get=lambda url,**_:Reply(SOURCES['AU'],'AU'))
        self.assertEqual(set(result['regions']),{'AU'})
    def test_failure_retains_original_timestamp_but_not_expired_data(self):
        prior=collect(now=NOW,get=lambda url,**_:Reply(url,next(k for k,v in SOURCES.items() if v==url)))
        fail=lambda url,**_:Reply(url,'AU',403)
        result=collect(prior,now=NOW+timedelta(hours=24),get=fail)
        self.assertEqual(result['regions'],prior['regions'])
        self.assertTrue(all(s['state']=='retained' for s in result['status'].values()))
        self.assertFalse(collect(prior,now=NOW+timedelta(hours=49),get=fail)['regions'])
if __name__=='__main__':unittest.main()
