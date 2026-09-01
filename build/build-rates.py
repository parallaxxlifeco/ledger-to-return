#!/usr/bin/env python3
"""
Rebuild the FX rate table embedded in ledger-to-return.html.

Source: European Central Bank daily euro reference rates, which ship inside the
`currencyconverter` package on PyPI (eurofxref-hist.csv, 1999 to present).
Each currency is crossed through EUR to give AUD per one unit of that currency.

    pip download currencyconverter --no-deps -d /tmp/cc
    python3 build-rates.py                 # writes rates.json

Then paste the contents of rates.json into ledger-to-return.html, replacing
everything between `const RATES=` and the `;` that closes it.

Weekends and public holidays have no published rate. Rather than interpolating,
every date carries a `back` value: how many days back the rate actually came
from (0 = published that day). The app surfaces that in the UI and the export
so any figure can be traced to a real published rate.
"""
import zipfile, io, csv, json, datetime, math, bisect, glob, os, sys

# Currencies worth carrying. AUD is the base (always 1.0); EUR falls out of the
# cross directly. Add more by appending the ECB's column name.
WANT = ['USD','IDR','GBP','SGD','THB','MYR','PHP','NZD','JPY',
        'CAD','CHF','CNY','HKD','INR','KRW','EUR']

# Start early enough to cover statements that spill either side of the tax year.
START = datetime.date(2024, 7, 1)

whl = sorted(glob.glob('/tmp/cc/currencyconverter-*.whl'))
if not whl:
    sys.exit("No wheel found. Run: pip download currencyconverter --no-deps -d /tmp/cc")
z = zipfile.ZipFile(whl[-1])
inner = zipfile.ZipFile(io.BytesIO(z.read('currency_converter/eurofxref-hist.zip')))
rows = list(csv.DictReader(io.StringIO(inner.read('eurofxref-hist.csv').decode())))

bydate = {}
for r in rows:
    d = r['Date'].strip()
    try:
        aud = float(r['AUD'])            # AUD per 1 EUR
    except (ValueError, TypeError):
        continue
    m = {'AUD': 1.0, 'EUR': aud}
    for c in WANT:
        if c == 'EUR':
            continue
        v = r.get(c, '').strip()
        if v in ('', 'N/A'):
            continue
        try:
            m[c] = aud / float(v)        # (AUD/EUR) / (CUR/EUR) = AUD per 1 CUR
        except (ValueError, ZeroDivisionError):
            pass
    bydate[d] = m

alld = sorted(bydate)
end = datetime.date.fromisoformat(alld[-1])
days = (end - START).days + 1
dates = [(START + datetime.timedelta(days=i)).isoformat() for i in range(days)]

def sig(x, n=7):
    if x is None or x == 0:
        return None
    return round(x, n - 1 - math.floor(math.log10(abs(x))))

src, back = [], []
for d in dates:
    if d in bydate:
        s = d
    else:
        i = bisect.bisect_left(alld, d)
        s = alld[i - 1] if i > 0 else None
    src.append(s)
    back.append((datetime.date.fromisoformat(d) - datetime.date.fromisoformat(s)).days if s else 0)

out = {'start': dates[0], 'end': dates[-1], 'n': days, 'back': back, 'r': {}}
for c in ['AUD'] + WANT:
    arr = [sig(bydate.get(s, {}).get(c)) for s in src]
    if any(v is not None for v in arr):
        out['r'][c] = arr

here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, 'rates.json')
with open(path, 'w') as f:
    json.dump(out, f, separators=(',', ':'))

print(f"{dates[0]} -> {dates[-1]}  ({days} days, {os.path.getsize(path)} bytes)")
print("currencies:", ", ".join(out['r']))
print("longest carry-forward:", max(back), "days")
