# Делает из инструкций docs/*.md страницы .html, которые удобно открыть в браузере.
# Запуск: pip install markdown && python tools/md2html.py docs/SETUP.md docs/ИНСТРУКЦИЯ.md
import markdown, re, sys, pathlib
CSS = """
:root { --fg: #1A1714; --muted: rgba(26,23,20,.62); --line: rgba(26,23,20,.12); --accent: #C2531E; --soft: #F6F3EE; }
* { box-sizing: border-box; }
body { margin: 0; background: #fff; color: var(--fg); font: 400 17px/1.65 "Onest", system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
main { max-width: 820px; margin: 0 auto; padding: 32px 16px 96px; }
h1 { font: 300 clamp(38px, 7vw, 60px)/1.02 "Cormorant Garamond", Georgia, serif; margin: 12px 0 18px; text-wrap: balance; }
h2 { font: 400 clamp(28px, 5vw, 36px)/1.1 "Cormorant Garamond", Georgia, serif; margin: 44px 0 10px; text-wrap: balance; }
h3 { font: 600 19px/1.3 "Onest", system-ui, sans-serif; margin: 30px 0 8px; }
p, li { max-width: 68ch; }
a { color: var(--accent); }
hr { border: 0; border-top: 1px solid var(--line); margin: 44px 0; }
code { font: 400 .88em/1.4 "JetBrains Mono", ui-monospace, Menlo, monospace; background: var(--soft); padding: 2px 5px; border-radius: 5px; }
pre { background: var(--soft); padding: 14px 16px; border-radius: 10px; overflow-x: auto; }
pre code { background: none; padding: 0; font-size: 14px; }
.table { overflow-x: auto; margin: 14px 0; }
table { border-collapse: collapse; width: 100%; font-size: 15.5px; }
th, td { text-align: left; vertical-align: top; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--line); }
th { font-weight: 600; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
strong { font-weight: 600; }
"""
FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Onest:wght@400;600&family=JetBrains+Mono&display=swap">'
for src in sys.argv[1:]:
    p = pathlib.Path(src)
    text = p.read_text(encoding='utf-8')
    title = re.search(r'^# (.+)$', text, re.M).group(1)
    body = markdown.markdown(text, extensions=['tables', 'fenced_code'])
    body = re.sub(r'href="([^"]+)\.md"', r'href="\1.html"', body)
    body = body.replace('<table>', '<div class="table"><table>').replace('</table>', '</table></div>')
    html = f'<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>{title} · Пространство</title>\n{FONTS}\n<style>{CSS}</style>\n</head>\n<body>\n<main>\n{body}\n</main>\n</body>\n</html>\n'
    p.with_suffix('.html').write_text(html, encoding='utf-8')
    print('ok', p.with_suffix('.html'))
