#!/usr/bin/env python3
"""Lokaler Webserver OHNE Caching.

Normale Browser cachen script.js und Bilder aggressiv - dann sieht man
nach einem Update scheinbar 'keine Aenderung'. Dieser Server schickt
No-Cache-Header, sodass jeder Reload garantiert die neueste Version laedt.

Start:  python3 tools/serve.py   (im Projektordner)
Dann:   http://localhost:8000
"""
import http.server
import socketserver
import os

PORT = 8000
# In den Projekt-Wurzelordner wechseln (eine Ebene ueber /tools)
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Server laeuft (ohne Cache) auf http://localhost:{PORT}")
        print("Zum Beenden: Strg + C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer beendet.")
