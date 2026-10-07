"""Focused DOM/CSS fixture; no server, room session or media device is started."""
from pathlib import Path
from playwright.sync_api import sync_playwright

css = (Path(__file__).resolve().parents[1] / "app/globals.css").read_text()
slots = """
<div class="guest-invite-slot"><div class="stack">
  <button>Скопировать инвайт для гостя</button><button class="button-secondary">Отозвать гостевые ссылки</button>
</div></div>
<div class="stream-invite-slot"><div class="stack">
  <button>Ссылка на поток студии</button><button class="button-secondary">Отозвать ссылки просмотра</button>
</div></div>
<div class="moderator-invite-slot"><div class="stack admin-invite-controls">
  <button class="invite-create">Создать ссылку модератора</button><button class="button-secondary invite-revoke">Отозвать ссылки модераторов комнаты</button>
</div></div>
<div class="admin-invite-slot"><div class="stack admin-invite-controls">
  <button class="invite-create">Создать ссылку администратора</button><button class="button-secondary invite-revoke">Отозвать все ссылки администратора</button>
</div></div>
<small class="invite-extra">Зрителей отдельного потока: 0</small>
"""

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
    for viewport, panel_width in [(1440, 555), (390, 358), (320, 288)]:
        page = browser.new_page(viewport={"width": viewport, "height": 900})
        for theme in ["dark", "light"]:
            page.set_content(f'<html data-theme="{theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head><body><div class="studio-main-column" style="width:{panel_width}px"><div class="panel"><section class="studio-invite-compact">{slots}</section></div></div></body></html>')
            sizes = page.locator(".studio-invite-compact button").evaluate_all("buttons => buttons.map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, overflow: button.scrollWidth > button.clientWidth + 1 }))")
            assert len(sizes) == 8
            assert all(size["width"] >= 140 and size["height"] <= 80 and not size["overflow"] for size in sizes), (viewport, theme, sizes)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (viewport, theme)
        page.close()
    browser.close()
print("PASS: compact invite buttons stay readable without implicit columns at 1440/390/320px in both themes")
