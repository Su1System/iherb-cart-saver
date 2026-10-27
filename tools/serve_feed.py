"""Narrow HTTPS origin: one public JSON file, no directory or private-file serving."""
from http.server import HTTPServer,BaseHTTPRequestHandler
from pathlib import Path
import ssl,os,json

STATE=Path(os.environ.get('IHERB_STATE_DIR','/var/lib/iherb-cart-saver'))

class OriginServer(HTTPServer):
    def __init__(self,address,context):
        self.context=context
        super().__init__(address,Handler)
    def get_request(self):
        client,address=super().get_request()
        client.settimeout(5)
        try:return self.context.wrap_socket(client,server_side=True),address
        except (OSError,ssl.SSLError):
            client.close()
            raise

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path!='/offers.json':self.send_error(404);return
        try:
            data=(STATE/'feed-state.json').read_bytes()
            if len(data)>65536:raise ValueError()
            payload=json.loads(data)
            if not isinstance(payload,dict) or payload.get('schema')!=1:raise ValueError()
        except (OSError,ValueError):self.send_error(503);return
        self.send_response(200)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(data)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers();self.wfile.write(data)
    def log_message(self,*args):pass

if __name__=='__main__':
    context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version=ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(os.environ['IHERB_ORIGIN_CERT'],os.environ['IHERB_ORIGIN_KEY'])
    server=OriginServer(('0.0.0.0',int(os.environ.get('IHERB_ORIGIN_PORT','8443'))),context)
    server.serve_forever()
