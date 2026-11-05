import asyncio, json, sys, io
from playwright.async_api import async_playwright
import os, pathlib
SP = str(pathlib.Path(__file__).parent / 'shots') + '/'; os.makedirs(SP, exist_ok=True)
BASE = os.environ.get('BASE', 'http://localhost:8765/')
results = []

def ok(n, cond, msg):
    results.append((n, bool(cond), msg))

def gray_png():
    from PIL import Image
    b = io.BytesIO(); Image.new('RGB', (400, 300), (128, 128, 128)).save(b, 'PNG'); return b.getvalue()

def leaf_png():
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (400, 300), (60, 140, 60)); d = ImageDraw.Draw(im)
    for x in range(40, 380, 60): d.ellipse([x, 100, x + 30, 130], fill=(30, 20, 15))
    for x in range(20, 380, 50): d.line([x, 0, x + 40, 300], fill=(200, 230, 200), width=3)
    b = io.BytesIO(); im.save(b, 'JPEG'); return b.getvalue()

LIVE = {
    "current": {"temperature_2m": 8.2, "relative_humidity_2m": 88, "precipitation": 0, "weather_code": 61, "wind_speed_10m": 2.1},
    "daily": {"time": ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"],
              "weather_code": [61, 63, 61, 2, 0, 3, 1, 0, 0], "temperature_2m_max": [15, 14, 15, 13, 12, 12, 13, 13, 14],
              "temperature_2m_min": [9, 9, 10, 5, -1, 0, 6, 2, 3], "precipitation_sum": [8, 6, 12, 0, 0, 0, 0, 0, 0],
              "precipitation_probability_max": [90, 80, 100, 20, 0, 30, 10, 10, 0]}}

async def page(b, vp=(390, 844), live=None, dark=False, block_storage=False):
    ctx = await b.new_context(viewport={'width': vp[0], 'height': vp[1]}, color_scheme='dark' if dark else 'light')
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    if live is not None:
        async def h(route):
            if live == 'fail': await route.abort()
            else: await route.fulfill(status=200, content_type='application/json', body=json.dumps(live))
        await pg.route('https://api.open-meteo.com/**', h)
    await pg.route('https://fonts.**', lambda r: r.abort())
    if block_storage:
        await pg.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
    await pg.goto(BASE); await pg.wait_for_selector('.tabs button[aria-current]', timeout=15000)
    return pg

async def overflow(pg):
    return await pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')

async def go(pg, h):
    await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(250)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])

        # 1 첫 방문(휴대폰): 오류·가로 넘침·탭 크기
        pg = await page(b, live='fail')
        ok(1, not pg.errs, f'스크립트 오류 없음 {pg.errs}')
        for h in ['#today', '#diagnose', '#log', '#machine', '#community']:
            await go(pg, h); ov = await overflow(pg); ok(1, ov <= 0, f'{h} 가로 넘침 {ov}px')
        sizes = await pg.evaluate("[...document.querySelectorAll('.tabs button')].map(b=>[b.offsetWidth,b.offsetHeight])")
        ok(1, all(w >= 44 and h >= 44 for w, h in sizes), f'탭 터치 크기 {sizes}')
        await go(pg, '#today'); await pg.screenshot(path=SP + '1.png', full_page=True)

        # 2 실시간 날씨(비·서리) 경로
        pg = await page(b, live=LIVE)
        t = await pg.inner_text('#view')
        ok(2, '서리 대비' in t, '서리 카드 제목')
        ok(2, '관수 보류' in t, '비 온 뒤 관수 보류 안내')
        ok(2, '탄저병' in t, '비 온 뒤 탄저병 확인 안내')
        ok(2, '실시간' in t and 'Open-Meteo' in t, '실시간 출처 표시')
        n0 = await pg.locator('[data-addtask]').count()
        await pg.locator('[data-addtask]').first.click(); await pg.wait_for_timeout(200)
        t = await pg.inner_text('#view'); ok(2, '덮개·보온 준비' in t.split('다가오는 일정')[1], '승인한 일정이 다가오는 일정에 표시')
        ok(2, n0 >= 3, f'안내 일정 버튼 수 {n0}')
        ok(2, await pg.locator('[data-addtask]').count() == n0 - 1 and '일정에 추가됨' in t, '추가한 안내는 다시 추가 못 함(중복 방지)')
        ok(2, '덮개·보온 준비' in (await pg.inner_text('.tl')), '다음에 할 일 카드에 실제 일정')

        # 3 감 탄저병 진단 → 기록·일정
        await go(pg, '#diagnose')
        for s in ['fruit_black_sunken', 'pink_spore']: await pg.click(f'[data-sym={s}]')
        await pg.click('#runDx'); await pg.wait_for_selector('#saveDx', timeout=8000)
        t = await pg.inner_text('#view')
        ok(3, '탄저병' in t and '확신 높음' in t, '탄저병 확신 높음')
        ok(3, '습한 조건' in t, '날씨 근거 포함')
        ct = ' '.join(await pg.locator('.cand').all_inner_texts()); ok(3, ct and not any(k in ct for k in ['희석', '배액', 'ml', '살포량', '배 희석']), '후보 카드에 약제 처방 없음')
        await pg.click('#saveDx'); await pg.wait_for_timeout(400)
        ok(3, pg.url.endswith('#log'), '저장 후 기록 화면 이동')
        t = await pg.inner_text('#view'); ok(3, '증상 관찰' in t and '확산 여부' in t, '기록과 재확인 일정 생성')

        # 4 아무것도 안 고르고 진단 / 흐린 사진
        pg4 = await page(b, live='fail'); await go(pg4, '#diagnose')
        await pg4.click('#runDx'); await pg4.wait_for_timeout(300)
        ok(4, await pg4.locator('#dxSteps .steps').count() == 0, '입력 없으면 진단 안 함')
        await pg4.set_input_files('#photo', files=[{'name': 'g.png', 'mimeType': 'image/png', 'buffer': gray_png()}]); await pg4.wait_for_timeout(600)
        t = await pg4.inner_text('#view'); ok(4, '흐릿' in t, f'흐린 사진 경고')
        await pg4.click('[data-sym=early_leaf_drop]'); await pg4.click('#runDx'); await pg4.wait_for_timeout(3000)
        t = await pg4.inner_text('#view'); ok(4, '판단하기 어려워요' in t, '흐린 사진 + 약한 특징 → 판단 어려움')

        # 5 미나리 진딧물 + 사진 저장(위치 정보 제거)
        await go(pg4, '#diagnose'); await pg4.click('[data-crop="미나리"]')
        await pg4.set_input_files('#photo', files=[{'name': 'l.jpg', 'mimeType': 'image/jpeg', 'buffer': leaf_png()}]); await pg4.wait_for_timeout(600)
        for s in ['small_insects', 'sticky']: await pg4.click(f'[data-sym={s}]')
        await pg4.click('#runDx'); await pg4.wait_for_selector('#saveDx', timeout=8000)
        t = await pg4.inner_text('#view'); ok(5, '진딧물' in t, '미나리 진딧물 후보')
        await pg4.check('#keepPhoto'); await pg4.click('#saveDx'); await pg4.wait_for_timeout(400)
        ok(5, await pg4.locator('img[alt="기록 사진"]').count() == 1, '사진 기록 저장')
        src = await pg4.get_attribute('img[alt="기록 사진"]', 'src'); ok(5, src.startswith('data:image/jpeg'), '다시 그린 JPEG(위치 정보 없음)')

        # 6 기록 → 다음 할 일 제안 → 승인
        await go(pg4, '#log'); await pg4.click('[data-work="관수"]'); await pg4.fill('#lgNote', '1번 밭 관수')
        await pg4.click('#lgSave'); await pg4.wait_for_timeout(300)
        ok(6, await pg4.locator('#sgYes').count() == 1, '다음 할 일 제안')
        await pg4.click('#sgYes'); await pg4.wait_for_timeout(300)
        t = await pg4.inner_text('#view'); ok(6, '흙 수분 확인' in t, '제안 승인 후 일정 추가')
        await go(pg4, '#today'); t = await pg4.inner_text('#view'); ok(6, '흙 수분 확인' in t, '오늘 화면에도 일정 표시')
        await pg4.fill('#lgNote', '') if await pg4.locator('#lgNote').count() else None

        # 7 농기계 임대: 잘못된 날짜 / 정상
        await go(pg4, '#machine'); await pg4.fill('#mcArea', '2'); await pg4.press('#mcArea', 'Enter'); await pg4.dispatch_event('#mcArea', 'change'); await pg4.wait_for_timeout(200)
        await pg4.click('[data-mw="방제"]'); t = await pg4.inner_text('#view'); ok(7, '고속분무기' in t, '2ha 방제 → 고속분무기')
        await pg4.fill('#rvFrom', '2026-11-10'); await pg4.fill('#rvTo', '2026-11-08'); await pg4.click('#rvSave'); await pg4.wait_for_timeout(200)
        ok(7, '날짜를 확인' in await pg4.inner_text('#toast'), '반납일이 앞서면 막음')
        await pg4.fill('#rvTo', '2026-11-11'); await pg4.click('#rvSave'); await pg4.wait_for_timeout(300)
        t = await pg4.inner_text('#view'); ok(7, '대여' in t and '반납' in t, '대여·반납 일정 2건')

        # 8 커뮤니티: XSS·개인정보·질문 관련 노하우·댓글·좋아요·신고
        await go(pg4, '#community')
        await pg4.click('#writeBtn'); await pg4.click('[data-wt="question"]')
        await pg4.fill('#wTitle', '<img src=x onerror="window.__x=1"> 서리 오면 덮개 언제?'); await pg4.fill('#wBody', '연락 010-1234-5678, 주민 900101-1234567')
        await pg4.click('#wSubmit'); await pg4.wait_for_timeout(400)
        t = await pg4.inner_text('#view')
        ok(8, not await pg4.evaluate('window.__x'), 'XSS 실행 안 됨')
        ok(8, '010-****-****' in t and '******-*******' in t and '1234-5678' not in t, '전화·주민번호 가림')
        ok(8, '이 질문과 관련된 선배 노하우' in t and '첫서리' not in t or '최저기온' in t, '질문에 관련 노하우 표시')
        await pg4.fill('[data-cin]', '저도 궁금해요'); await pg4.click('[data-csend]'); await pg4.wait_for_timeout(200)
        ok(8, '저도 궁금해요' in await pg4.inner_text('#view'), '댓글 등록')
        before = await pg4.locator('[data-like]').first.inner_text(); await pg4.locator('[data-like]').first.click(); await pg4.wait_for_timeout(150)
        after = await pg4.locator('[data-like]').first.inner_text(); ok(8, before != after, f'좋아요 반영 {before}->{after}')
        cnt = await pg4.locator('article.post').count(); pg4.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg4.locator('[data-report]').last.click(); await pg4.wait_for_timeout(300)
        ok(8, await pg4.locator('article.post').count() == cnt - 1, '신고하면 숨김')
        await pg4.fill('#askIn', '탄저병 어떻게 해요'); await pg4.click('#askBtn'); await pg4.wait_for_timeout(300)
        ok(8, '관련 노하우' in await pg4.inner_text('#view'), '탄저병 질문 → 노하우 찾음')

        # 9 저장소 막힘(사생활 모드) / 새로고침 후 유지
        pg9 = await page(b, live='fail', block_storage=True)
        ok(9, not pg9.errs and await pg9.locator('.hero').count() == 1, f'저장소 막혀도 화면 표시 {pg9.errs}')
        await pg4.reload(); await pg4.wait_for_selector('.tabs button[aria-current]'); await go(pg4, '#log')
        ok(9, '흙 수분 확인' in await pg4.inner_text('#view'), '새로고침 후 데이터 유지')

        # 10 데스크톱·다크 모드·접근성
        pgd = await page(b, vp=(1440, 1000), live=LIVE)
        ok(10, await overflow(pgd) <= 0, '데스크톱 가로 넘침 없음')
        cols = await pgd.evaluate("getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length")
        ok(10, cols == 2, f'데스크톱 2단 {cols}')
        await pgd.screenshot(path=SP + '10-desk.png')
        pgk = await page(b, live=LIVE, dark=True); await pgk.screenshot(path=SP + '10-dark.png', full_page=True)
        unl = await pgk.evaluate("""[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='hidden'&&e.type!=='file'&&!e.labels?.length&&!e.getAttribute('aria-label')&&!e.placeholder).length""")
        for h in ['#log', '#machine', '#community', '#diagnose']:
            await go(pgk, h)
            unl += await pgk.evaluate("""[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='hidden'&&e.type!=='file'&&!e.labels?.length&&!e.getAttribute('aria-label')&&!e.placeholder).length""")
        ok(10, unl == 0, f'이름 없는 입력칸 {unl}개')
        await go(pgk, '#today'); await pgk.keyboard.press('Tab'); await pgk.keyboard.press('Tab')
        ok(10, await pgk.evaluate('document.activeElement!==document.body'), '키보드로 이동 가능')
        await b.close()

    fails = [r for r in results if not r[1]]
    for n in range(1, 11):
        rs = [r for r in results if r[0] == n]
        print(f'#{n}: {sum(r[1] for r in rs)}/{len(rs)} 통과' + ''.join(f'\n   FAIL {r[2]}' for r in rs if not r[1]))
    print('TOTAL', len(results) - len(fails), '/', len(results))

asyncio.run(main())
