#!/usr/bin/env python3
"""يبني Orders/index.html: ملف HTML واحد فيه كل شيء (الواجهة + Excel + PDF)."""
import base64, pathlib
d = pathlib.Path(__file__).parent; s = d / 'src'
rd = lambda n: (s / n).read_text(encoding='utf-8')
h = rd('index.src.html')
for k, v in {'XLSX': rd('xlsx.min.js'), 'PDFJS': rd('pdf.min.js'), 'APP': rd('app.js'),
             'WORKER': base64.b64encode((s / 'pdf.worker.min.js').read_bytes()).decode()}.items():
    assert '</script' not in v.lower()
    h = h.replace(f'/*@@{k}@@*/', v)
(d / 'index.html').write_text(h, encoding='utf-8')
print('OK', (d / 'index.html').stat().st_size // 1024, 'KB')
