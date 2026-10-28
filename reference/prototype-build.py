"""Wraps page.html into a standalone site/index.html with SEO + social tags for deployment."""
import pathlib, re

root = pathlib.Path(__file__).parent
body = (root / "page.html").read_text(encoding="utf-8")

# Move <title>, font links and <style> into <head>; drop the artifact-only meta tag.
head_bits = []
for pat in [r"<title>.*?</title>", r'<link rel="preconnect"[^>]*>', r'<link rel="stylesheet"[^>]*>', r"<style>.*?</style>"]:
    for m in re.findall(pat, body, flags=re.S):
        head_bits.append(m)
        body = body.replace(m, "", 1)
body = re.sub(r'<meta name="claude:viewport-fit-sides"[^>]*>\s*', "", body)

DESC = "Join the GlowBite Water Flosser pre-order list. 5 modes, 350 ml tank, 5 tips, USB-C charging. Pre-order interest price ₹1,299. No payment taken now."
seo = f"""<meta name="description" content="{DESC}">
<meta property="og:type" content="website">
<meta property="og:title" content="Glowbite Water Flosser · Join the Pre-order List">
<meta property="og:description" content="{DESC}">
<meta property="og:image" content="/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#000000">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23000000'/%3E%3Cpath d='M19 4 10 18h6l-3 10 10-15h-6l3-9z' fill='%2300C2FF'/%3E%3C/svg%3E">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"Product","name":"Glowbite Water Flosser","brand":{{"@type":"Brand","name":"Glowbite"}},"image":"/og.png","description":"Rechargeable water flosser with 5 modes including a child mode, a 350 ml water tank, 5 tips and USB-C charging.","offers":{{"@type":"Offer","price":"1299","priceCurrency":"INR","availability":"https://schema.org/PreOrder"}}}}</script>"""

html = f"""<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{seo}
{chr(10).join(head_bits)}
</head>
<body>
{body.strip()}
</body>
</html>
"""
out = root / "site" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
import shutil; shutil.copy(root / "assets" / "og.png", root / "site" / "og.png")
print("wrote", out, len(html), "bytes")
