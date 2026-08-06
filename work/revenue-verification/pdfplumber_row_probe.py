import re
from pathlib import Path
import pdfplumber

base = Path('docs/Raw Data/Revenue')
patterns = ['11111','11121','11411','1142','1151','113','13','133','14','14111','31','32','33','41']
for year in range(2008, 2013):
    path = base / f'{year}-jan-dec-consolidated-revenue.pdf'
    found = {p: None for p in patterns}
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ''
            for line in text.splitlines():
                compact = re.sub(r'\s+', ' ', line).strip()
                for code in patterns:
                    if found[code] is None and re.search(rf'(^|\s){re.escape(code)}(\s|$)', compact):
                        nums = re.findall(r'-?\d[\d,]*\.\d+|-?\d[\d,]*', compact)
                        found[code] = (page_no, compact[:180], nums[:6])
    missing = [code for code, hit in found.items() if hit is None]
    print(f'YEAR {year} missing={missing}')
    for code in ['11111','11411','13','133','14','14111','31','32','33']:
        hit = found[code]
        print(f'  {code}: page={hit[0] if hit else None}; nums={hit[2] if hit else None}')
