import re
from pathlib import Path
import pdfplumber

def money_count(line: str) -> int:
    return len(re.findall(r'-?\d[\d,]*\.\d{2}|-?\d[\d,]*\.\d+', line))

for year in range(2008, 2013):
    path = Path('docs/Raw Data/Revenue') / f'{year}-jan-dec-consolidated-revenue.pdf'
    print(f'YEAR {year} short-code candidates')
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ''
            for line in text.splitlines():
                compact = re.sub(r'\s+', ' ', line).strip()
                if re.match(r'^(13|14|31|32|33|41)\s+', compact) and money_count(compact) >= 3:
                    print(f'  page={page_no} {compact[:220]}')
