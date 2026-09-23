#!/usr/bin/env python3
"""
CommBank credit card statement (PDF) -> CSV for Ledger to Return.

The layout is fixed-width text once pdftotext -layout has run:

    11 Jun   Crossfit Wanderlust Fi Badung          14.03
             ##0000      148010.00RUPIAH
    11 Jun   Intnl Transaction Fee                   0.00

Three things the format does that a naive reader gets wrong:
  * dates carry no year, so it comes from the statement period, which can
    straddle new year (a Dec-Jan statement has both);
  * credits carry a TRAILING minus ("673.48-"), not a leading one;
  * the foreign amount sits on its own continuation line and belongs to the
    row above it. CommBank has already converted to AUD, and that AUD figure
    is what actually left the account, so it stays authoritative -- the
    original is carried along as a note, not re-converted.
"""
import re, sys, csv, subprocess, io
from datetime import datetime

MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
MON = {m: i + 1 for i, m in enumerate(MONTHS)}

ROW = re.compile(r'^(\d{1,2}) ([A-Z][a-z]{2})\s{2,}(\S.*?)\s{2,}([\d,]+\.\d{2})(-?)$')
FX  = re.compile(r'^##\d+\s+([\d,]+\.\d{2})\s*([A-Z][A-Z ]+)$')
PERIOD = re.compile(r'Statement Period\s+(\d{1,2} [A-Z][a-z]{2} \d{4})\s*-\s*(\d{1,2} [A-Z][a-z]{2} \d{4})')
CARD = re.compile(r'(\d{4} \d{4} \d{4} \d{4})')

CUR = {"RUPIAH": "IDR", "US DOLLAR": "USD", "EURO": "EUR", "NZ DOLLAR": "NZD",
       "POUND STERLING": "GBP", "SINGAPORE DOLLAR": "SGD", "THAI BAHT": "THB",
       "JAPANESE YEN": "JPY", "HONG KONG DOLLAR": "HKD", "CANADIAN DOLLAR": "CAD",
       "SWISS FRANC": "CHF", "UAE DIRHAM": "AED", "MALAYSIAN RINGGIT": "MYR"}

def text_of(path):
    return subprocess.run(["pdftotext", "-layout", path, "-"],
                          capture_output=True, text=True, check=True).stdout

def strip_gutter(line):
    """Each page carries a rotated print-code in the left margin that pdftotext
       drops into the middle of a row. It always ends with the version stamp."""
    return re.sub(r'^\s*(\*#\*\s*)?[\d.]+ ZZ\d+ \d+ [A-Z.\d]+ V [\d.]+\s*', '', line).strip()

def parse(path):
    txt = text_of(path)
    per = PERIOD.search(txt)
    if not per:
        raise SystemExit("Could not find the statement period — is this a CommBank card statement?")
    start = datetime.strptime(per.group(1), "%d %b %Y")
    end   = datetime.strptime(per.group(2), "%d %b %Y")
    card  = CARD.search(txt)
    acct  = "CommBank card " + card.group(1)[-4:] if card else "CommBank card"

    def year_for(day, mon):
        """Pick the year that puts the date inside the statement period."""
        for y in (start.year, end.year):
            try: d = datetime(y, MON[mon], day)
            except ValueError: continue
            if start <= d <= end: return d
        return datetime(start.year, MON[mon], day)

    rows, seen_tx = [], False
    for raw in txt.split("\n"):
        line = strip_gutter(raw)
        if line.startswith("Transactions"): seen_tx = True
        m = ROW.match(line)
        if m:
            day, mon, desc, amt, neg = m.groups()
            if mon not in MON: continue
            desc = desc.strip()
            d = year_for(int(day), mon)
            val = float(amt.replace(",", ""))
            # A charge costs money: negative. A credit/payment: positive.
            signed = val if neg else -val
            rows.append({"date": d.strftime("%Y-%m-%d"), "acct": acct, "desc": desc,
                         "aud": round(signed, 2) + 0.0, "cur": "", "orig": ""})
            continue
        f = FX.match(line)
        if f and rows:
            amt, name = f.groups()
            name = name.strip()
            rows[-1]["cur"] = CUR.get(name, name)
            rows[-1]["orig"] = amt.replace(",", "")
    return rows, txt

def reconcile(rows, txt):
    def money(pat):
        m = re.search(pat, txt)
        return float(m.group(1).replace(",", "")) if m else None
    opening = money(r'Opening balance at .*?\$([\d,]+\.\d{2})')
    charges = money(r'New transactions and charges\s+\$([\d,]+\.\d{2})')
    payments= money(r'Payments/refunds\s+-\$([\d,]+\.\d{2})')
    closing = money(r'Closing balance at .*?\$([\d,]+\.\d{2})')
    got_ch  = round(-sum(r["aud"] for r in rows if r["aud"] < 0), 2)
    got_pay = round( sum(r["aud"] for r in rows if r["aud"] > 0), 2)
    return {"statement_charges": charges, "parsed_charges": got_ch,
            "statement_payments": payments, "parsed_payments": got_pay,
            "opening": opening, "closing": closing,
            "check": None if None in (opening, charges, payments, closing)
                     else round(opening + got_ch - got_pay, 2)}

def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: cba_card_pdf.py STATEMENT.pdf [OUT.csv]")
    rows, txt = parse(sys.argv[1])
    out = sys.argv[2] if len(sys.argv) > 2 else None
    """Waived fees and zero-dollar FX-fee lines are most of the statement by row
       count and none of it by value. They are dropped, after reconciling, so the
       sort queue is not 40% noise. --keep-zeros puts them back."""
    rec = reconcile(rows, txt)
    if "--keep-zeros" not in sys.argv:
        before = len(rows)
        rows = [r for r in rows if abs(r["aud"]) >= 0.005]
        rec["zero_rows_dropped"] = before - len(rows)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Date", "Account", "Description", "Currency", "Original amount", "Amount (AUD)"])
    for r in rows:
        w.writerow([r["date"], r["acct"], r["desc"], r["cur"], r["orig"], f'{r["aud"]:.2f}'])
    data = buf.getvalue()
    if out:
        open(out, "w").write(data)
        print(f"wrote {out} — {len(rows)} rows")
    else:
        sys.stdout.write(data)
    print("\nRECONCILIATION", file=sys.stderr)
    for k, v in rec.items(): print(f"  {k}: {v}", file=sys.stderr)

if __name__ == "__main__":
    main()
