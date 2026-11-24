"""Recheck the public source fixture. A mismatch exits nonzero without rewriting the snapshot."""
import concurrent.futures
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
import requests
from unicodedata import normalize


class VisibleText(HTMLParser):
    def __init__(self): super().__init__();self.hidden=0;self.chunks=[]
    def handle_starttag(self,tag,attrs):
        if tag in ("script","style","svg","noscript"):self.hidden+=1
    def handle_endtag(self,tag):
        if tag in ("script","style","svg","noscript"):self.hidden=max(0,self.hidden-1)
    def handle_data(self,text):
        if not self.hidden:self.chunks.append(text)


def norm(text):
    return " ".join(normalize("NFKC",text).replace("\u200b","").split()).casefold()


def check(source):
    try:
        page=requests.get(source["url"],headers={"User-Agent":"Mozilla/5.0 (compatible; FirstChairSourceReview/1.0)"},timeout=25)
        page.raise_for_status();parser=VisibleText();parser.feed(page.text)
        return source["id"],norm(source["quote"]) in norm(" ".join(parser.chunks))
    except requests.RequestException: return source["id"],False


if __name__=="__main__":
    data=json.loads((Path(__file__).resolve().parents[1]/"data/prospects.json").read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        results=list(pool.map(check,[s for a in data for s in a["sources"]]))
    for key,ok in results:print(("OK " if ok else "MISMATCH ")+key)
    sys.exit(int(any(not ok for _,ok in results)))
