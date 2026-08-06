from pathlib import Path
from pypdf import PdfReader
for year in range(2008, 2013):
    path = Path('docs/Raw Data/Revenue') / f'{year}-jan-dec-consolidated-revenue.pdf'
    reader = PdfReader(str(path))
    meta = reader.metadata or {}
    print(f'{year}\tpages={len(reader.pages)}\ttitle={meta.get("/Title", "")}\tproducer={meta.get("/Producer", "")}\tcreator={meta.get("/Creator", "")}')
