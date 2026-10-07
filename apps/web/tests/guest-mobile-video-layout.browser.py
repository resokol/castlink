"""Real Chromium CSS/DOM regression using the captured RoomConference markup.

Uses production LiveKit styles, app CSS and video-fit helper with a canvas poster;
no camera, microphone, SFU, server state changes or physical-phone claims.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[3]
output = Path(os.environ.get("CASTLINK_LAYOUT_OUTPUT") or tempfile.mkdtemp(prefix="castlink-mobile-video-"))
output.mkdir(parents=True, exist_ok=True)
css = (root / "apps/web/node_modules/@livekit/components-styles/dist/general/index.css").read_text() + "\n" + (root / "apps/web/app/globals.css").read_text()
markup = (root / "apps/web/tests/guest-controls-rendered.html").read_text()
fit = subprocess.check_output([
    "node", "-e",
    "const fs=require('fs'),ts=require('typescript');process.stdout.write(ts.transpileModule(fs.readFileSync('lib/video-fit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)",
], cwd=root / "apps/web", text=True)
results = []
failures = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get("CASTLINK_QA_CHROMIUM_BINARY", "/usr/bin/chromium"), args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
    try:
        for width, height in [(320, 568), (390, 844), (667, 375), (1440, 900)]:
            page = browser.new_page(viewport={"width": width, "height": height}, is_mobile=width < 700)
            for count, studio_only in [(1, True), (1, False), (2, False)]:
                page.set_content('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style>' + markup)
                page.evaluate("""({count, studioOnly}) => {
                    const conference=document.querySelector('.lk-video-conference');
                    conference.dataset.singleParticipant=String(count===1);
                    conference.dataset.trackCount=String(count);
                    conference.style.setProperty('--conference-mobile-columns',String(count===1?1:2));
                    conference.style.setProperty('--conference-mobile-rows','1');
                    if(count===1)document.querySelectorAll('.castlink-tile-shell')[1].remove();
                    if(studioOnly){
                        document.querySelector('.guest-conference-grid').classList.add('studio-only-grid');
                        const notice=document.createElement('div');notice.className='studio-only-notice';notice.setAttribute('role','status');
                        notice.textContent='Студия включила только свой просмотр';
                        document.querySelector('.lk-video-conference-inner').prepend(notice);
                        document.querySelector('.castlink-chat-toggle').remove();document.querySelector('.lk-chat').remove();
                    }
                    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
                    const context=canvas.getContext('2d');context.fillStyle='#394365';context.fillRect(0,0,1280,720);
                    context.strokeStyle='#a6eeff';context.lineWidth=12;context.strokeRect(10,10,1260,700);
                    context.fillStyle='white';context.font='64px sans-serif';context.fillText('CastLink video',80,100);context.fillText('FULL FRAME',720,650);
                    const poster=canvas.toDataURL();
                    document.querySelectorAll('.lk-participant-tile').forEach(tile=>{
                        tile.dataset.lkVideoMuted='false';const video=document.createElement('video');video.className='lk-participant-media-video';
                        tile.querySelector('.lk-participant-placeholder')?.remove();
                        video.muted=true;video.playsInline=true;video.poster=poster;tile.prepend(video);
                        Object.defineProperty(video,'videoWidth',{value:1280});Object.defineProperty(video,'videoHeight',{value:720});
                    });
                }""", {"count": count, "studioOnly": studio_only})
                page.wait_for_function("document.querySelector('video').videoWidth===1280")
                page.evaluate("() => {window.exports={};" + fit + "}")
                page.evaluate("document.querySelectorAll('video').forEach(v=>window.exports.applyContainedVideoFit(v,v.parentElement,0))")
                info = page.evaluate("""() => {
                    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
                    const wrapper=document.querySelector('.lk-scroll-layout-wrapper'),grid=document.querySelector('.guest-conference-grid');
                    return {viewport:{width:innerWidth,height:innerHeight},pageWidth:document.documentElement.scrollWidth,
                        conference:rect(grid),wrapper:rect(wrapper),footer:rect(document.querySelector('footer')),
                        leave:rect(document.querySelector('.room-leave-button')),leavePosition:getComputedStyle(document.querySelector('.room-leave-button')).position,
                        notice:document.querySelector('.studio-only-notice')?rect(document.querySelector('.studio-only-notice')):null,
                        scrollHeight:wrapper.scrollHeight,clientHeight:wrapper.clientHeight,
                        tiles:[...document.querySelectorAll('.castlink-tile-shell')].map(rect),
                        videos:[...document.querySelectorAll('video')].map(v=>({video:rect(v),frame:rect(v.parentElement),fit:getComputedStyle(v).objectFit})),
                        controls:[...document.querySelectorAll('.guest-control-row button')].filter(e=>getComputedStyle(e).display!=='none').map(rect)};
                }""")
                case = {"width": width, "height": height, "count": count, "studioOnly": studio_only, **info}
                name = f"{width}-{count}-{'studio-only' if studio_only else 'room'}"
                (output / (name + ".geometry.json")).write_text(json.dumps(case, ensure_ascii=False, indent=2))
                page.screenshot(path=str(output / (name + ".png")))
                case_failures = []
                if info["pageWidth"] > width + 1: case_failures.append("horizontal overflow")
                if info["wrapper"]["bottom"] > info["footer"]["y"] + 1: case_failures.append("controls overlap video")
                if count == 1 and width < 700:
                    # A lone video must occupy a substantial area even with the real wrapped controls/banner.
                    minimum = min(180, (width - 42) * 9 / 16)
                    if min(tile["h"] for tile in info["tiles"]) < minimum: case_failures.append("single video collapsed below normal landscape frame height")
                if width == 390 and count == 2 and min(tile["h"] for tile in info["tiles"]) < 150: case_failures.append("two video regression")
                if width < 700 and info["leavePosition"] != "static": case_failures.append("exit overlays page")
                if info["scrollHeight"] > info["clientHeight"] + 2: case_failures.append("unexpected tile scroll")
                for button in info["controls"]:
                    if not 30 <= button["h"] <= 64: case_failures.append("unusable control size")
                    if button["y"] < info["footer"]["y"] - 1 or button["bottom"] > info["footer"]["bottom"] + 1: case_failures.append("control outside footer")
                for item in info["videos"]:
                    video, frame = item["video"], item["frame"]
                    if item["fit"] != "contain" or video["x"] < frame["x"] - 1 or video["right"] > frame["right"] + 1 or video["y"] < frame["y"] - 1 or video["bottom"] > frame["bottom"] + 1: case_failures.append("source frame cropped")
                case["failures"] = sorted(set(case_failures)); results.append(case)
                if case_failures: failures.append(name)
            page.close()
    finally:
        browser.close()
(output / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps({"output": str(output), "cases": len(results), "failures": failures, "tiles": [{"width": r["width"], "count": r["count"], "studioOnly": r["studioOnly"], "height": r["tiles"][0]["h"]} for r in results]}, ensure_ascii=False), flush=True)
if os.environ.get("CASTLINK_LAYOUT_BASELINE") != "1":
    assert not failures, failures
