import { FARM, WORK_TYPES, SYMPTOMS, PESTS, PEST_LINKS, MACHINE_RULES, RENTAL, SEED_POSTS, SEED_COMMENTS, TOPICS } from './data.js';

/* ---------- 공통 ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const md = (d) => { const [, m, dd] = d.split('-'); return `${+m}/${+dd}`; };
const dow = (d) => '일월화수목금토'[new Date(d + 'T00:00:00Z').getUTCDay()];
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtTime = (iso) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' });
const maskPersonal = (t) => String(t)
  .replace(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, '010-****-****')
  .replace(/\d{6}[-\s]?[1-4]\d{6}/g, '******-*******');

function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

async function getJSON(url, ms = 6000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

// 나중에 Copilot SDK 에이전트 API(/api/...)가 붙으면 그쪽을 먼저 쓰고, 없으면 앱 안 규칙으로 대신한다.
async function tryApi(path, body, ms = 8000) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
    return await r.json();
  } catch { return null; }
}

/* ---------- 저장소 (이 브라우저에만 저장) ---------- */
const KEY = 'baekkimchi.farm.v1';
let S = null;
function load() { try { S = JSON.parse(localStorage.getItem(KEY)); } catch { S = null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('저장 공간이 부족해요. 사진 저장을 줄여 주세요.'); } }

async function initState() {
  load();
  if (S && S.v === 1) return;
  let profile = null, logs = [], programs = [];
  try { profile = await getJSON('seed/demo-profile.json'); } catch {}
  try { logs = (await getJSON('seed/demo-logs.json')).logs || []; } catch {}
  try { programs = (await getJSON('seed/programs.json')).programs || []; } catch {}
  S = {
    v: 1,
    profile: profile || { nickname: '청도 새내기 농부', birthYear: 1994, independentFarmingYears: 2, fields: [{ id: 'field-1', name: '1번 밭', crop: '감(반시)', areaHa: 0.3 }], totalAreaHa: 0.3 },
    programs,
    logs: logs.map((l) => ({ id: uid(), date: l.date, fieldId: l.fieldId, work: l.work, hours: l.hours, note: l.note, example: true })),
    tasks: [],
    posts: SEED_POSTS.map((p) => ({ ...p })),
    comments: SEED_COMMENTS.map((c) => ({ ...c })),
    liked: {},
    hidden: [],
  };
  save();
}
const fieldName = (id) => (S.profile.fields.find((f) => f.id === id) || {}).name || id || '';
const fieldCrop = (id) => (S.profile.fields.find((f) => f.id === id) || {}).crop || '';

/* ---------- 날씨 (Open-Meteo 실시간, 실패 시 기상청 자료 스냅샷) ---------- */
const WX = { 0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '안개', 51: '이슬비', 53: '이슬비', 55: '이슬비', 56: '어는 비', 57: '어는 비', 61: '비', 63: '비', 65: '많은 비', 66: '어는 비', 67: '어는 비', 71: '눈', 73: '눈', 75: '많은 눈', 77: '눈', 80: '소나기', 81: '소나기', 82: '강한 소나기', 85: '눈', 86: '눈', 95: '뇌우', 96: '뇌우', 99: '뇌우' };
let weather = null;

async function loadWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${FARM.lat}&longitude=${FARM.lon}` +
    '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max' +
    '&past_days=3&forecast_days=7&timezone=Asia%2FSeoul&wind_speed_unit=ms';
  try {
    const j = await getJSON(url);
    const days = j.daily.time.map((d, i) => ({
      date: d, code: j.daily.weather_code[i], sky: WX[j.daily.weather_code[i]] || '-',
      min: j.daily.temperature_2m_min[i], max: j.daily.temperature_2m_max[i],
      rain: j.daily.precipitation_sum[i] ?? 0, pop: j.daily.precipitation_probability_max[i] ?? null,
    }));
    const t = todayStr();
    weather = {
      source: 'live', fetchedAt: new Date().toISOString(),
      sourceName: 'Open-Meteo 실시간 예보 (청도군 좌표)', sourceUrl: 'https://open-meteo.com',
      current: { t: j.current.temperature_2m, h: j.current.relative_humidity_2m, sky: WX[j.current.weather_code] || '-', wind: j.current.wind_speed_10m },
      past: days.filter((d) => d.date < t), days: days.filter((d) => d.date >= t),
    };
  } catch {
    try {
      const s = await getJSON('seed/forecast-cheongdo-20261105.json');
      weather = {
        source: 'snapshot', fetchedAt: s.baseTime, sourceName: s.sourceNote, sourceUrl: s.sourceUrl,
        current: { t: s.today.tempC, h: s.today.humidityPct, sky: s.today.sky, wind: s.today.windMs },
        past: [],
        days: [{ date: s.today.date, sky: s.today.sky, min: s.today.minC, max: s.today.maxC, rain: 10, pop: 100 },
          ...s.days.map((d) => ({ date: d.date, sky: d.pm || d.am, min: d.minC, max: d.maxC, rain: 0, pop: Math.max(d.amRainPct, d.pmRainPct) }))],
      };
    } catch { weather = null; }
  }
}

/* ---------- 오늘 할 일 판단 (근거 포함) ---------- */
function buildAdvice() {
  const out = [];
  if (!weather) return out;
  const today = weather.days[0];
  const recentRain = weather.past.slice(-2).reduce((a, d) => a + (d.rain || 0), 0) + (today?.rain || 0);
  const crops = new Set(S.profile.fields.map((f) => f.crop));

  // 서리·저온
  const frost = weather.days.slice(0, 5).find((d) => d.min <= 1);
  if (frost) {
    const prep = frost.date === today.date ? frost.date : addDays(frost.date, -1);
    out.push({ level: 'warn', icon: '❄️', title: `${md(frost.date)}(${dow(frost.date)}) 최저 ${frost.min}℃ 예보 — 덮개·보온 준비`,
      why: `예보 최저기온 ${frost.min}℃로 서리 가능성이 있어요. 남은 반시는 먼저 수확하고, 어린나무 밑동 보온을 권장해요.`,
      task: { title: '덮개·보온 준비, 남은 반시 먼저 수확', date: prep } });
  }
  // 관수
  const lastWater = S.logs.filter((l) => /관수|물/.test(l.work)).map((l) => l.date).sort().pop();
  if (recentRain >= 5 || (today?.pop ?? 0) >= 60) {
    out.push({ level: 'ok', icon: '💧', title: '관수 보류',
      why: `최근 강수 ${recentRain.toFixed(1)}mm${today?.pop != null ? `, 오늘 강수확률 ${today.pop}%` : ''}. 흙이 젖어 있으면 물을 주지 않아도 돼요.` });
  } else if (crops.has('감(반시)')) {
    out.push({ level: 'info', icon: '💧', title: '흙 상태 보고 관수 판단',
      why: `최근 강수 ${recentRain.toFixed(1)}mm로 적어요.${lastWater ? ` 마지막 물 관리 기록: ${md(lastWater)}.` : ''} 손으로 흙을 쥐어 보고 마른 경우에만 주세요.`,
      task: { title: '감나무 밑 흙 수분 확인', date: today.date } });
  }
  // 병 확산 위험
  if (recentRain >= 10 && crops.has('감(반시)')) {
    out.push({ level: 'warn', icon: '🔍', title: '비 온 뒤 탄저병 열매 확인',
      why: `최근 비 ${recentRain.toFixed(1)}mm. 습한 날이 이어지면 탄저병 반점이 늘 수 있어요. 의심 열매는 사진 진단으로 확인하세요.`,
      task: { title: '탄저병 의심 열매 확인·제거', date: addDays(today.date, 1) }, link: '#diagnose' });
  }
  // 미나리
  if (crops.has('미나리')) {
    const cold = weather.days.slice(0, 3).some((d) => d.min <= 3);
    out.push({ level: 'info', icon: '🌿', title: '미나리 수위·물길 확인',
      why: cold ? '기온이 내려가요. 수위를 조금 높이고 물이 고이지 않게 흐름을 확인하세요.' : '물이 고이지 않게 들어오고 나가는 물길을 확인하세요.',
      task: { title: '미나리 수위·물길 확인', date: today.date } });
  }
  // 수확 후 밑거름
  const harvested = S.logs.some((l) => /수확/.test(l.work));
  const fertilized = S.logs.some((l) => /시비|비료|거름/.test(l.work));
  if (harvested && !fertilized) {
    out.push({ level: 'info', icon: '🧪', title: '수확 후 밑거름 계획 — 토양검정 먼저',
      why: '수확 기록은 있고 시비 기록은 없어요. 양은 토양검정 결과로 흙토람 비료사용처방서를 받아 정하세요. 앱이 양을 정하지 않아요.',
      task: { title: '농업기술센터 토양검정 신청', date: addDays(today.date, 2) } });
  }
  return out;
}

/* ---------- 지원사업 ---------- */
function programMatch(p) {
  const age = 2026 - (S.profile.birthYear || 1994) - 1; // 만 나이 대략
  const out = [];
  for (const c of p.conditions || []) {
    const r = c.rule;
    if (!r) { out.push({ text: c.text, st: c.needsCheck ? 'check' : 'info' }); continue; }
    let ok = true;
    if (r.ageMin != null && age < r.ageMin) ok = false;
    if (r.ageMaxExclusive != null && age >= r.ageMaxExclusive) ok = false;
    if (r.independentFarmingYearsMax != null && (S.profile.independentFarmingYears ?? 99) > r.independentFarmingYearsMax) ok = false;
    out.push({ text: c.text, st: ok ? 'ok' : 'no' });
  }
  const st = out.some((o) => o.st === 'no') ? 'no' : out.some((o) => o.st === 'check') ? 'maybe' : 'maybe';
  return { st, out };
}

/* ---------- 화면: 오늘 ---------- */
function viewToday() {
  const adv = buildAdvice();
  const t = todayStr();
  const pending = S.tasks.filter((x) => !x.done).sort((a, b) => a.date.localeCompare(b.date));
  const w = weather;
  const wxHtml = w ? `
    <div class="card">
      <div class="wx">
        <div class="big">${Math.round(w.current.t)}°</div>
        <div><b>${esc(w.current.sky)}</b> · 습도 ${esc(w.current.h)}% · 바람 ${esc(w.current.wind)}m/s
          <div class="small muted">${esc(FARM.region)} · 오늘 ${w.days[0].min}° / ${w.days[0].max}°</div></div>
      </div>
      <div class="days">${w.days.slice(0, 6).map((d) => `
        <div class="day ${d.min <= 1 ? 'frost' : ''}"><b>${d.date === t ? '오늘' : md(d.date) + '(' + dow(d.date) + ')'}</b>${esc(d.sky)}<br>${Math.round(d.min)}° / ${Math.round(d.max)}°${d.pop != null ? `<br><span class="muted">☔ ${d.pop}%</span>` : ''}</div>`).join('')}</div>
      <div class="src">${w.source === 'live' ? '<span class="tag ok">실시간</span>' : '<span class="tag warn">스냅샷</span>'}
        출처: <a href="${esc(w.sourceUrl)}" target="_blank" rel="noopener">${esc(w.sourceName)}</a> · 기준 ${esc(fmtTime(w.fetchedAt))}</div>
    </div>` : '<div class="card">날씨를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</div>';

  const progs = (S.programs || []).map((p) => ({ p, m: programMatch(p) })).filter((x) => x.m.st !== 'no');

  return `
  <h1>오늘 할 일</h1>
  <p class="sub">${md(t)}(${dow(t)}) · ${esc(S.profile.nickname)} · 밭 ${S.profile.fields.length}곳 ${S.profile.totalAreaHa ?? ''}ha</p>
  ${wxHtml}
  <h2>날씨로 본 관리 안내 <span class="tag ai">AI 정리</span></h2>
  ${adv.length ? adv.map((a, i) => `
    <div class="card tight adv ${a.level}">
      <div class="ic" aria-hidden="true">${a.icon}</div>
      <div class="grow"><b>${esc(a.title)}</b><div class="why">근거: ${esc(a.why)}</div>
        <div class="row wrap-it" style="margin-top:8px">
          ${a.task ? `<button class="btn sm" data-addtask="${i}">일정에 추가 (${md(a.task.date)})</button>` : ''}
          ${a.link ? `<a class="btn sm ghost" href="${a.link}">사진 진단</a>` : ''}
        </div></div>
    </div>`).join('') : '<div class="empty">지금은 특별히 챙길 일이 없어요.</div>'}

  <h2>다가오는 일정</h2>
  <div class="card">${pending.length ? `<ul class="list">${pending.slice(0, 6).map((x) => `
    <li class="row"><input type="checkbox" data-done="${x.id}" aria-label="완료"><div class="grow"><b>${esc(x.title)}</b>
      <div class="small muted">${md(x.date)}(${dow(x.date)})${x.date < t ? ' · <span class="tag danger">지남</span>' : x.date === t ? ' · <span class="tag warn">오늘</span>' : ''} ${x.from ? '· ' + esc(x.from) : ''}</div></div></li>`).join('')}</ul>`
    : '<div class="empty">승인한 일정이 없어요. 위 안내에서 "일정에 추가"를 눌러 보세요.</div>'}</div>

  <h2>해당될 수 있는 지원사업</h2>
  ${progs.length ? progs.map(({ p, m }) => `
    <div class="card tight"><b>${esc(p.name)}</b> <span class="tag warn">해당될 수 있음 · 확인 필요</span>
      <div class="small muted">${esc(p.operator || '')} · ${esc(p.benefit || '')}</div>
      <ul class="small" style="margin:6px 0 0;padding-left:18px">${m.out.map((o) => `<li>${o.st === 'ok' ? '✅' : o.st === 'check' ? '❓' : '•'} ${esc(o.text)}</li>`).join('')}</ul>
      ${p.deadline ? `<div class="small muted" style="margin-top:6px">일정: ${esc(p.deadline.text || p.deadline)}</div>` : ''}
      <div class="small">${(p.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(' · ')}</div>
    </div>`).join('') : '<div class="empty">조건에 맞는 사업을 찾지 못했어요.</div>'}
  <p class="notice">자격은 앱이 판정하지 않아요. 신청 전 공고 원문을 확인하세요.</p>`;
}
function bindToday(root) {
  const adv = buildAdvice();
  root.querySelectorAll('[data-addtask]').forEach((b) => b.onclick = () => {
    const a = adv[+b.dataset.addtask];
    S.tasks.push({ id: uid(), title: a.task.title, date: a.task.date, from: '날씨 안내', done: false }); save();
    toast('일정에 추가했어요'); render();
  });
  root.querySelectorAll('[data-done]').forEach((c) => c.onchange = () => {
    const x = S.tasks.find((t) => t.id === c.dataset.done); x.done = true; save(); toast('완료했어요'); render();
  });
}

/* ---------- 화면: 사진 진단 ---------- */
const dx = { crop: '감(반시)', picked: new Set(), photo: null, stats: null, result: null, running: false, keepPhoto: false };

function analyzePhoto(img) {
  const W = 160, H = Math.max(1, Math.round(img.height * (160 / img.width)));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  let green = 0, brown = 0, dark = 0, white = 0, yellow = 0, lum = [], n = W * H;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), v = mx, s = mx ? (mx - mn) / mx : 0;
    let h = 0; if (mx !== mn) { h = mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; }
    lum.push(0.299 * r + 0.587 * gg + 0.114 * b);
    if (v < 0.18) dark++;
    else if (s < 0.12 && v > 0.85) white++;
    else if (h >= 70 && h <= 170 && s > 0.2) green++;
    else if (h >= 45 && h < 70 && s > 0.35 && v > 0.5) yellow++;
    else if (h >= 10 && h < 45 && s > 0.25 && v < 0.7) brown++;
  }
  let lap = 0; // 흐림 정도 (라플라시안 분산)
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; const L = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - W] - lum[i + W]; lap += L * L;
  }
  lap /= (W - 2) * (H - 2);
  const meanL = lum.reduce((a, b) => a + b, 0) / n;
  const pct = (x) => Math.round((x / n) * 100);
  return { green: pct(green), brown: pct(brown), dark: pct(dark), white: pct(white), yellow: pct(yellow), blurry: lap < 0.0015, tooDark: meanL < 0.22 };
}

function photoToJpeg(img, max = 640) { // 다시 그려 저장하면 위치 정보(EXIF)가 빠진다
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}

function localDiagnose() {
  const picked = [...dx.picked];
  const wet = weather ? (weather.past.slice(-2).reduce((a, d) => a + (d.rain || 0), 0) + (weather.days[0]?.rain || 0)) >= 10 : false;
  const cands = PESTS.filter((p) => p.crop === dx.crop).map((p) => {
    const hit = p.keys.filter((k) => dx.picked.has(k));
    let score = hit.length / p.keys.length;
    const ev = hit.map((k) => '체크한 특징: ' + SYMPTOMS[dx.crop].find((s) => s.id === k).label);
    if (hit.length && p.wetBoost && wet) { score += 0.15; ev.push('최근 비가 많이 와 습한 조건 (날씨 데이터)'); }
    if (hit.length && dx.stats && (dx.stats.brown + dx.stats.dark) >= 8 && /반점|검/.test(p.feature)) ev.push(`사진 색 분석: 갈색·검은 영역 ${dx.stats.brown + dx.stats.dark}%`);
    if (hit.length && dx.stats && dx.stats.white >= 5 && /흰/.test(p.feature)) ev.push(`사진 색 분석: 흰 영역 ${dx.stats.white}%`);
    return { p, hit, score, ev };
  }).filter((c) => c.hit.length).sort((a, b) => b.score - a.score);

  // 검증: 체크한 특징 중 극히 일부만 설명하는 후보는 뺀다
  const kept = [], dropped = [];
  for (const c of cands) {
    const share = picked.length ? c.hit.length / picked.length : 0;
    if (c.hit.length === 1 && share < 0.34 && kept.concat(cands).some((o) => o.hit.length >= 2)) dropped.push(c); else kept.push(c);
  }
  const top = kept.slice(0, 3).map((c) => ({ ...c, conf: c.score >= 0.66 && c.hit.length >= 2 ? '높음' : c.score >= 0.34 ? '중간' : '낮음' }));
  const hard = !top.length || (dx.stats && (dx.stats.blurry || dx.stats.tooDark) && top.every((c) => c.conf !== '높음'));
  return { top, dropped, hard, source: 'local' };
}

function viewDiagnose() {
  const syms = SYMPTOMS[dx.crop];
  const r = dx.result;
  const st = dx.stats;
  return `
  <h1>사진으로 증상 확인</h1>
  <p class="sub">작물을 고르고 사진을 올린 뒤, 보이는 특징을 골라 주세요.</p>
  <div class="card">
    <div class="chips" role="group" aria-label="작물">${Object.keys(SYMPTOMS).map((c) => `<button class="chip" data-crop="${esc(c)}" aria-pressed="${c === dx.crop}">${esc(c)}</button>`).join('')}</div>
    <label class="f" for="photo">사진 (잎 앞·뒤, 열매, 줄기)</label>
    <label class="drop" for="photo">${dx.photo ? `<img src="${dx.photo}" alt="올린 작물 사진">` : '📷 눌러서 사진 찍기 또는 고르기'}</label>
    <input id="photo" type="file" accept="image/*" capture="environment" hidden>
    ${st ? `<div class="small" style="margin-top:8px">사진 색 분석(간이): 초록 ${st.green}% · 노랑 ${st.yellow}% · 갈색 ${st.brown}% · 검은 영역 ${st.dark}% · 흰 영역 ${st.white}%
      ${st.blurry ? '<br><span class="tag warn">사진이 흐릿해요</span>' : ''}${st.tooDark ? '<br><span class="tag warn">사진이 어두워요</span>' : ''}</div>` : ''}
    <label class="f">보이는 특징 (여러 개 선택)</label>
    <div class="chips">${syms.map((s) => `<button class="chip" data-sym="${s.id}" aria-pressed="${dx.picked.has(s.id)}">${esc(s.label)}</button>`).join('')}</div>
    <div style="margin-top:14px"><button class="btn primary block" id="runDx" ${dx.running ? 'disabled' : ''}>증상 확인하기</button></div>
  </div>
  <div id="dxSteps"></div>
  ${r ? renderDxResult(r) : ''}
  <p class="notice">결과는 AI 추정이에요. 약제명·희석 배수는 알려 드리지 않아요. 등록 약제는 <a href="${PEST_LINKS.pesticide}" target="_blank" rel="noopener">농약안전정보시스템</a>에서 확인하고 라벨대로 쓰세요.</p>`;
}

function renderDxResult(r) {
  if (r.hard) return `
    <div class="card"><h3>판단하기 어려워요 <span class="tag ai">AI 추정</span></h3>
      <p class="small">특징이 부족하거나 사진이 흐려 후보를 정하기 어려워요.</p>
      <ul class="small"><li>가까이, 밝은 곳에서 다시 찍어 주세요.</li><li>잎은 앞면과 뒷면을 모두 찍어 주세요.</li><li>계속 모르겠으면 청도군 농업기술센터에 사진을 보여 주세요.</li></ul>
      <a href="${PEST_LINKS.ncpms}" target="_blank" rel="noopener">국가농작물병해충관리시스템 도감 보기</a></div>`;
  return `
  <h2>의심 후보 <span class="tag ai">AI 추정</span></h2>
  ${r.top.map((c) => `
    <div class="card cand ${c.conf === '높음' ? 'high' : c.conf === '중간' ? 'mid' : 'low'}">
      <div class="row"><h3 class="grow">${esc(c.p.name)} <span class="muted small">(${esc(c.p.kind)})</span></h3><span class="tag ${c.conf === '높음' ? 'danger' : c.conf === '중간' ? 'warn' : ''}">확신 ${c.conf}</span></div>
      <p class="small">${esc(c.p.feature)}</p>
      <div class="small"><b>근거</b><ul style="margin:4px 0;padding-left:18px">${c.ev.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>
      <div class="small"><b>지금 할 관리</b><ul style="margin:4px 0;padding-left:18px">${c.p.care.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>
      <div class="small"><a href="${PEST_LINKS.ncpms}" target="_blank" rel="noopener">도감에서 증상 비교</a> · <a href="${PEST_LINKS.pesticide}" target="_blank" rel="noopener">등록 약제 확인</a></div>
    </div>`).join('')}
  ${r.dropped.length ? `<div class="card tight small"><b>검증에서 뺀 후보</b>: ${r.dropped.map((c) => esc(c.p.name)).join(', ')} — 고른 특징 중 일부만 설명해서 근거가 부족해요.</div>` : ''}
  <div class="card tight">
    <label class="row small"><input type="checkbox" id="keepPhoto" ${dx.keepPhoto ? 'checked' : ''}> 사진도 기록에 저장 (위치 정보는 지우고 저장)</label>
    <button class="btn primary block" id="saveDx" style="margin-top:10px">확인했어요 — 영농 기록에 남기기</button>
  </div>`;
}

function bindDiagnose(root) {
  root.querySelectorAll('[data-crop]').forEach((b) => b.onclick = () => { dx.crop = b.dataset.crop; dx.picked.clear(); dx.result = null; render(); });
  root.querySelectorAll('[data-sym]').forEach((b) => b.onclick = () => {
    const id = b.dataset.sym; dx.picked.has(id) ? dx.picked.delete(id) : dx.picked.add(id); b.setAttribute('aria-pressed', dx.picked.has(id));
  });
  $('#photo', root).onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!f.type.startsWith('image/') || f.size > 15e6) { toast('15MB 이하 이미지만 올릴 수 있어요'); return; }
    const url = URL.createObjectURL(f); const img = new Image();
    img.onload = () => { dx.stats = analyzePhoto(img); dx.photo = photoToJpeg(img); URL.revokeObjectURL(url); dx.result = null; render(); };
    img.src = url;
  };
  $('#runDx', root).onclick = async () => {
    if (!dx.picked.size && !dx.photo) { toast('사진을 올리거나 특징을 하나 이상 골라 주세요'); return; }
    dx.running = true; $('#runDx', root).disabled = true;
    const steps = ['사진 특징 정리', '도감 비교 ∥ 날씨·이번 달 발생정보 확인', '의심 후보 정리', '검증 — 근거 부족 후보 제외'];
    const box = $('#dxSteps', root);
    const draw = (k) => box.innerHTML = `<div class="card tight"><div class="steps">${steps.map((s, i) => `<div class="step ${i < k ? 'done' : i === k ? 'run' : ''}"><span class="dot"></span>${s}</div>`).join('')}</div></div>`;
    for (let k = 0; k < steps.length; k++) { draw(k); await new Promise((r) => setTimeout(r, 450)); }
    const api = await tryApi('/api/diagnose', { crop: dx.crop, symptoms: [...dx.picked], stats: dx.stats, image: dx.photo });
    dx.result = api && api.top ? api : localDiagnose();
    dx.running = false; render();
  };
  const kp = $('#keepPhoto', root); if (kp) kp.onchange = () => dx.keepPhoto = kp.checked;
  const sv = $('#saveDx', root); if (sv) sv.onclick = () => {
    const r = dx.result; const field = S.profile.fields.find((f) => f.crop === dx.crop);
    S.logs.push({ id: uid(), date: todayStr(), fieldId: field?.id, work: '증상 관찰', hours: 0.2,
      note: r.hard ? '사진 진단: 판단 어려움' : `사진 진단(AI 추정): ${r.top.map((c) => `${c.p.name}(${c.conf})`).join(', ')}`,
      photo: dx.keepPhoto ? dx.photo : null });
    if (!r.hard) S.tasks.push({ id: uid(), title: `${r.top[0].p.name} 확산 여부 다시 확인`, date: addDays(todayStr(), 3), from: '사진 진단', done: false });
    save(); toast('영농 기록에 남겼어요'); dx.result = null; dx.photo = null; dx.stats = null; dx.picked.clear(); location.hash = '#log';
  };
}

/* ---------- 화면: 기록·일정 ---------- */
let logSuggest = null;
function nextSuggestion(log) {
  const w = log.work;
  if (/관수/.test(w)) return { title: '흙 수분 확인 (다음 관수 판단)', date: addDays(log.date, 3) };
  if (/방제/.test(w)) return { title: '방제 효과 확인', date: addDays(log.date, 7) };
  if (/수확/.test(w)) return { title: '수확 후 밑거름 계획 (토양검정 확인)', date: addDays(log.date, 7) };
  if (/시비/.test(w)) return { title: '시비 후 생육 상태 확인', date: addDays(log.date, 14) };
  if (/농기계/.test(w)) return { title: '임대 농기계 반납', date: addDays(log.date, 1) };
  if (/덮개/.test(w)) return { title: '덮개 걷기 (기온 오른 뒤)', date: addDays(log.date, 3) };
  return null;
}
function viewLog() {
  const t = todayStr();
  const logs = [...S.logs].sort((a, b) => b.date.localeCompare(a.date));
  const tasks = [...S.tasks].sort((a, b) => a.date.localeCompare(b.date));
  return `
  <h1>영농 기록·일정</h1>
  <p class="sub">기록을 남기면 다음 할 일을 제안해요. 승인한 것만 일정에 들어가요.</p>
  <div class="card">
    <div class="row"><div class="grow"><label class="f" for="lgDate">날짜</label><input type="date" id="lgDate" value="${t}"></div>
      <div class="grow"><label class="f" for="lgField">밭</label><select id="lgField">${S.profile.fields.map((f) => `<option value="${f.id}">${esc(f.name)} · ${esc(f.crop)}</option>`).join('')}</select></div></div>
    <label class="f">작업</label>
    <div class="chips" id="lgWork">${WORK_TYPES.map((w, i) => `<button class="chip" data-work="${esc(w)}" aria-pressed="${i === 0}">${esc(w)}</button>`).join('')}</div>
    <div class="row"><div style="width:120px"><label class="f" for="lgHours">시간</label><input type="number" id="lgHours" min="0" step="0.5" value="2"></div>
      <div class="grow"><label class="f" for="lgNote">메모</label><input type="text" id="lgNote" maxlength="200" placeholder="예: 2번 밭 반시 20상자"></div></div>
    <button class="btn primary block" id="lgSave" style="margin-top:14px">기록 저장</button>
  </div>
  ${logSuggest ? `<div class="card tight adv info"><div class="ic">🗓️</div><div class="grow"><b>다음 할 일 제안</b> <span class="tag ai">AI 제안</span>
    <div class="why">${esc(logSuggest.title)} · ${md(logSuggest.date)}(${dow(logSuggest.date)})</div>
    <div class="row" style="margin-top:8px"><button class="btn sm primary" id="sgYes">일정에 추가</button><button class="btn sm ghost" id="sgNo">괜찮아요</button></div></div></div>` : ''}

  <h2>일정</h2>
  <div class="card">${tasks.length ? `<ul class="list">${tasks.map((x) => `
    <li class="row"><input type="checkbox" data-done="${x.id}" ${x.done ? 'checked' : ''} aria-label="완료"><div class="grow" style="${x.done ? 'opacity:.55;text-decoration:line-through' : ''}"><b>${esc(x.title)}</b>
    <div class="small muted">${md(x.date)}(${dow(x.date)}) ${x.from ? '· ' + esc(x.from) : ''}</div></div>
    <button class="btn sm ghost" data-del="${x.id}" aria-label="삭제">✕</button></li>`).join('')}</ul>` : '<div class="empty">아직 일정이 없어요.</div>'}
    <button class="btn sm" id="notify" style="margin-top:8px">🔔 오늘 일정 브라우저 알림 받기</button></div>

  <h2>기록</h2>
  <div class="card">${logs.length ? `<ul class="list">${logs.map((l) => `
    <li><div class="row"><b class="grow">${esc(l.work)}</b><span class="small muted">${md(l.date)}(${dow(l.date)})</span></div>
      <div class="small muted">${esc(fieldName(l.fieldId))} ${l.hours ? '· ' + esc(l.hours) + '시간' : ''} ${l.example ? '· <span class="tag">예시</span>' : ''}</div>
      ${l.note ? `<div class="small">${esc(l.note)}</div>` : ''}
      ${l.photo ? `<img src="${l.photo}" alt="기록 사진" style="max-width:160px;border-radius:10px;margin-top:6px">` : ''}</li>`).join('')}</ul>` : '<div class="empty">기록이 없어요.</div>'}</div>`;
}
function bindLog(root) {
  let work = WORK_TYPES[0];
  root.querySelectorAll('[data-work]').forEach((b) => b.onclick = () => {
    work = b.dataset.work; root.querySelectorAll('[data-work]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  });
  $('#lgSave', root).onclick = () => {
    const log = { id: uid(), date: $('#lgDate', root).value || todayStr(), fieldId: $('#lgField', root).value, work, hours: +$('#lgHours', root).value || 0, note: maskPersonal($('#lgNote', root).value.trim()) };
    S.logs.push(log); save(); logSuggest = nextSuggestion(log); toast('기록을 저장했어요'); render();
  };
  const y = $('#sgYes', root); if (y) y.onclick = () => { S.tasks.push({ id: uid(), ...logSuggest, from: '기록 제안', done: false }); logSuggest = null; save(); toast('일정에 추가했어요'); render(); };
  const n = $('#sgNo', root); if (n) n.onclick = () => { logSuggest = null; render(); };
  root.querySelectorAll('[data-done]').forEach((c) => c.onchange = () => { S.tasks.find((t) => t.id === c.dataset.done).done = c.checked; save(); render(); });
  root.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { if (confirm('이 일정을 지울까요?')) { S.tasks = S.tasks.filter((t) => t.id !== b.dataset.del); save(); render(); } });
  $('#notify', root).onclick = async () => {
    if (!('Notification' in window)) { toast('이 브라우저는 알림을 지원하지 않아요'); return; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { toast('알림이 허용되지 않았어요'); return; }
    const due = S.tasks.filter((t) => !t.done && t.date <= todayStr());
    new Notification('오늘 할 일', { body: due.length ? due.map((t) => t.title).join(', ') : '오늘 남은 일정이 없어요.' });
  };
}

/* ---------- 화면: 농기계 ---------- */
const mc = { work: '방제', area: null };
function viewMachine() {
  if (mc.area == null) mc.area = S.profile.totalAreaHa || 0.5;
  const rule = (MACHINE_RULES[mc.work] || []).find((r) => mc.area <= r.max);
  const rentals = S.tasks.filter((t) => t.from === '농기계 임대' && !t.done);
  return `
  <h1>농기계 추천·임대</h1>
  <p class="sub">밭 크기와 작업을 고르면 맞는 농기계와 청도 임대사업소를 알려 드려요.</p>
  <div class="card">
    <label class="f" for="mcArea">면적 (ha)</label><input type="number" id="mcArea" min="0.01" step="0.05" value="${mc.area}">
    <div class="small muted">1ha = 10,000㎡ ≈ 3,025평 · 지금 밭 합계 ${S.profile.totalAreaHa ?? '-'}ha</div>
    <label class="f">작업</label>
    <div class="chips">${Object.keys(MACHINE_RULES).map((w) => `<button class="chip" data-mw="${esc(w)}" aria-pressed="${w === mc.work}">${esc(w)}</button>`).join('')}</div>
  </div>
  <div class="card adv"><div class="ic">🚜</div><div class="grow"><b>${esc(rule?.m || '-')}</b> <span class="tag">예시 기준</span>
    <div class="why">근거: ${esc(mc.work)} 작업, 면적 ${esc(mc.area)}ha. 실제 임대 가능 기종과 사용법은 임대사업소에서 확인하세요. 처음 쓰는 기계는 사용 교육을 받으세요.</div></div></div>

  <h2>청도 임대사업소</h2>
  <div class="card">
    <p class="small" style="margin-top:0">${esc(RENTAL.summary)}</p>
    <ul class="list">${RENTAL.offices.map((o) => `<li><b>${esc(o.name)}</b><div class="small muted">주소·전화는 청도군농업기술센터 또는 아래 공공데이터에서 확인</div></li>`).join('')}</ul>
    <div class="small">${RENTAL.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(' · ')}</div>
  </div>

  <h2>예약을 일정에 기록</h2>
  <div class="card">
    <p class="small muted" style="margin-top:0">실시간 예약 현황은 공개된 연동 방법을 찾지 못했어요. 전화로 예약한 뒤 여기 적어 두면 대여·반납 알림을 만들어 드려요.</p>
    <div class="row"><div class="grow"><label class="f" for="rvOffice">사업소</label><select id="rvOffice">${RENTAL.offices.map((o) => `<option>${esc(o.name)}</option>`).join('')}</select></div></div>
    <label class="f" for="rvMachine">기종</label><input type="text" id="rvMachine" value="${esc(rule?.m || '')}" maxlength="40">
    <div class="row"><div class="grow"><label class="f" for="rvFrom">대여일</label><input type="date" id="rvFrom" value="${addDays(todayStr(), 1)}"></div>
      <div class="grow"><label class="f" for="rvTo">반납일</label><input type="date" id="rvTo" value="${addDays(todayStr(), 2)}"></div></div>
    <button class="btn primary block" id="rvSave" style="margin-top:14px">대여·반납 일정 추가</button>
    ${rentals.length ? `<ul class="list" style="margin-top:10px">${rentals.map((t) => `<li class="small">${md(t.date)} · ${esc(t.title)}</li>`).join('')}</ul>` : ''}
  </div>`;
}
function bindMachine(root) {
  root.querySelectorAll('[data-mw]').forEach((b) => b.onclick = () => { mc.work = b.dataset.mw; render(); });
  $('#mcArea', root).onchange = (e) => { mc.area = Math.max(0.01, +e.target.value || 0.5); render(); };
  $('#rvSave', root).onclick = () => {
    const o = $('#rvOffice', root).value, m = $('#rvMachine', root).value.trim() || '농기계', f = $('#rvFrom', root).value, t = $('#rvTo', root).value;
    if (!f || !t || t < f) { toast('날짜를 확인해 주세요'); return; }
    S.tasks.push({ id: uid(), title: `${m} 대여 (${o})`, date: f, from: '농기계 임대', done: false });
    S.tasks.push({ id: uid(), title: `${m} 반납 (${o})`, date: t, from: '농기계 임대', done: false });
    S.logs.push({ id: uid(), date: todayStr(), fieldId: S.profile.fields[0]?.id, work: '농기계 사용', hours: 0, note: `${o} ${m} 예약 ${md(f)}~${md(t)}` });
    save(); toast('대여·반납 일정을 추가했어요'); render();
  };
}

/* ---------- 화면: 커뮤니티 ---------- */
const cm = { tab: 'all', topic: '전체', q: '', open: null, ask: '', askResult: null };
// 질문의 낱말 앞 두 글자(어간)를 원글에서 찾는다. 흔한 말은 뺀다.
const STOP = new Set(['해야', '하나', '하는', '하면', '어떻', '언제', '어디', '무엇', '뭘', '전에', '있나', '없나', '좋을', '좋은', '이번', '올해', '처음', '그리', '너무', '정말', '같아', '같은', '주세', '알려', '궁금', '방법', '때는', '어느', '얼마']);
const stems = (s) => [...new Set(String(s).split(/[^0-9a-zA-Z가-힣]+/).filter((w) => w.length >= 2).map((w) => w.slice(0, 2)))].filter((t) => !STOP.has(t));
function related(text, excludeId) {
  const q = stems(text);
  if (!q.length) return [];
  return S.posts.filter((p) => p.type === 'tip' && p.id !== excludeId && !S.hidden.includes(p.id)).map((p) => {
    const head = p.title + ' ' + p.topic, all = head + ' ' + p.body;
    const hits = q.filter((t) => all.includes(t));
    const score = hits.reduce((a, t) => a + (head.includes(t) ? 2 : 1), 0) + (hits.length && p.senior ? 0.3 : 0);
    return { p, score };
  }).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score).slice(0, 3);
}
const firstSentence = (b) => (String(b).match(/[^.!?。]+[.!?。]?/) || [b])[0].trim();

function viewCommunity() {
  const q = cm.q.trim();
  let posts = S.posts.filter((p) => !S.hidden.includes(p.id));
  if (cm.tab === 'tip') posts = posts.filter((p) => p.type === 'tip');
  if (cm.tab === 'question') posts = posts.filter((p) => p.type === 'question');
  if (cm.topic !== '전체') posts = posts.filter((p) => p.topic === cm.topic);
  if (q) posts = posts.filter((p) => (p.title + p.body + p.author).includes(q));
  posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ar = cm.askResult;
  return `
  <h1>농부 커뮤니티</h1>
  <p class="sub">선배 농부의 노하우를 모으고, 새내기가 물으면 관련 노하우를 찾아 드려요.</p>
  <div class="card">
    <label class="f" for="askIn" style="margin-top:0">선배 노하우에게 물어보기</label>
    <div class="row"><input type="text" id="askIn" maxlength="120" value="${esc(cm.ask)}" placeholder="예: 서리 오기 전에 뭘 해야 하나요?"><button class="btn primary" id="askBtn">찾기</button></div>
    ${ar ? (ar.length ? `<div class="summary"><b>관련 노하우 ${ar.length}개</b> <span class="tag ai">AI 정리 · 원글 문장 그대로</span>
      <ol>${ar.map((x) => `<li>${esc(firstSentence(x.p.body))} <a href="#community" data-openpost="${x.p.id}">— ${esc(x.p.author)}</a></li>`).join('')}</ol>
      <div class="small muted">원글에 없는 내용은 덧붙이지 않았어요. 농약·안전 관련 내용은 공식 자료로 다시 확인하세요.</div></div>`
      : `<div class="summary">관련 노하우를 찾지 못했어요. <button class="btn sm" id="askPost">질문 글로 올리기</button></div>`) : ''}
  </div>
  <div class="seg" role="group" aria-label="글 종류">${[['all', '전체'], ['tip', '노하우'], ['question', '질문']].map(([k, l]) => `<button data-tab="${k}" aria-pressed="${cm.tab === k}">${l}</button>`).join('')}</div>
  <div class="chips" style="margin-bottom:12px">${TOPICS.map((t) => `<button class="chip" data-topic="${esc(t)}" aria-pressed="${cm.topic === t}">${esc(t)}</button>`).join('')}</div>
  <div class="row" style="margin-bottom:12px"><input type="text" id="cmSearch" placeholder="글 검색" value="${esc(cm.q)}"><button class="btn primary" id="writeBtn">✏️ 글쓰기</button></div>
  ${posts.length ? posts.map(renderPost).join('') : '<div class="empty">글이 없어요. 첫 글을 남겨 보세요.</div>'}
  <p class="notice">지금은 글이 이 기기 브라우저에만 저장돼요. 전화번호·주민번호는 자동으로 가려요. "예시" 표시는 시연용 가상 글이에요.</p>
  <dialog id="writeDlg"><form method="dialog" class="in" id="writeForm">
    <h3>글쓰기</h3>
    <div class="seg" id="wType"><button type="button" data-wt="tip" aria-pressed="true">노하우 공유</button><button type="button" data-wt="question" aria-pressed="false">질문하기</button></div>
    <div class="row"><div class="grow"><label class="f" for="wCrop">작물</label><select id="wCrop"><option>감(반시)</option><option>미나리</option><option>공통</option></select></div>
      <div class="grow"><label class="f" for="wTopic">주제</label><select id="wTopic">${TOPICS.slice(1).map((t) => `<option>${esc(t)}</option>`).join('')}</select></div></div>
    <label class="f" for="wAuthor">닉네임</label><input type="text" id="wAuthor" maxlength="20" value="${esc(S.profile.nickname || '')}">
    <label class="row small" style="margin-top:8px"><input type="checkbox" id="wSenior"> 영농 5년 이상 선배 농부예요 (본인 표시)</label>
    <label class="f" for="wTitle">제목</label><input type="text" id="wTitle" maxlength="60" required>
    <label class="f" for="wBody">내용</label><textarea id="wBody" maxlength="1500" required></textarea>
    <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" value="cancel" type="button" id="wCancel">취소</button><button class="btn primary" id="wSubmit" type="submit">올리기</button></div>
  </form></dialog>`;
}
function renderPost(p) {
  const cs = S.comments.filter((c) => c.postId === p.id);
  const open = cm.open === p.id;
  const rel = open && p.type === 'question' ? related(p.title + ' ' + p.body, p.id) : [];
  return `
  <article class="card post" id="post-${p.id}">
    <div class="row wrap-it" style="margin-bottom:4px">
      <span class="tag ${p.type === 'question' ? 'warn' : 'ok'}">${p.type === 'question' ? '질문' : '노하우'}</span>
      <span class="tag">${esc(p.crop)}</span><span class="tag">${esc(p.topic)}</span>${p.example ? '<span class="tag">예시</span>' : ''}
    </div>
    <h3><button class="btn ghost" style="padding:0;min-height:0;border:0;text-align:left;font-size:16px" data-openpost="${p.id}">${esc(p.title)}</button></h3>
    <div class="meta">${p.senior ? '<span class="tag badge-senior">선배</span>' : ''}${esc(p.author)} · ${esc(fmtTime(p.createdAt))} · 댓글 ${cs.length}</div>
    ${open ? `<p style="white-space:pre-wrap">${esc(p.body)}</p>
      ${rel.length ? `<div class="summary"><b>이 질문과 관련된 선배 노하우</b> <span class="tag ai">AI 정리</span><ol>${rel.map((x) => `<li>${esc(firstSentence(x.p.body))} — ${esc(x.p.author)}</li>`).join('')}</ol></div>` : ''}
      ${cs.map((c) => `<div class="comment">${c.senior ? '<span class="tag badge-senior">선배</span>' : ''}<b>${esc(c.author)}</b> <span class="small muted">${esc(fmtTime(c.createdAt))}</span><div style="white-space:pre-wrap">${esc(c.body)}</div></div>`).join('')}
      <div class="row" style="margin-top:10px"><input type="text" data-cin="${p.id}" maxlength="500" placeholder="${p.type === 'question' ? '답변 남기기' : '댓글 남기기'}"><button class="btn sm primary" data-csend="${p.id}">등록</button></div>` : `<p class="small muted" style="margin:6px 0 0">${esc(firstSentence(p.body))}</p>`}
    <div class="row" style="margin-top:10px">
      <button class="btn sm ${S.liked[p.id] ? 'primary' : ''}" data-like="${p.id}">👍 도움돼요 ${p.likes + (S.liked[p.id] ? 1 : 0)}</button>
      <span class="grow"></span>
      <button class="btn sm ghost" data-report="${p.id}">신고·숨기기</button>
    </div>
  </article>`;
}
function bindCommunity(root) {
  root.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { cm.tab = b.dataset.tab; render(); });
  root.querySelectorAll('[data-topic]').forEach((b) => b.onclick = () => { cm.topic = b.dataset.topic; render(); });
  $('#cmSearch', root).onchange = (e) => { cm.q = e.target.value; render(); };
  root.querySelectorAll('[data-openpost]').forEach((b) => b.onclick = (e) => {
    e.preventDefault(); const id = b.dataset.openpost; cm.open = cm.open === id ? null : id;
    if (cm.open) { cm.tab = 'all'; cm.topic = '전체'; cm.q = ''; }
    render(); if (cm.open) setTimeout(() => document.getElementById('post-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  });
  root.querySelectorAll('[data-like]').forEach((b) => b.onclick = () => { const id = b.dataset.like; S.liked[id] = !S.liked[id]; save(); render(); });
  root.querySelectorAll('[data-report]').forEach((b) => b.onclick = () => {
    if (confirm('이 글을 신고하고 내 화면에서 숨길까요?')) { S.hidden.push(b.dataset.report); save(); toast('숨겼어요'); render(); }
  });
  root.querySelectorAll('[data-csend]').forEach((b) => b.onclick = () => {
    const inp = root.querySelector(`[data-cin="${b.dataset.csend}"]`); const v = inp.value.trim(); if (!v) return;
    S.comments.push({ id: uid(), postId: b.dataset.csend, author: S.profile.nickname || '익명', senior: false, createdAt: new Date().toISOString(), body: maskPersonal(v) });
    save(); render();
  });
  const doAsk = async () => {
    cm.ask = $('#askIn', root).value.trim(); if (!cm.ask) return;
    const api = await tryApi('/api/community/ask', { question: cm.ask });
    cm.askResult = api && api.items ? api.items : related(cm.ask);
    render();
  };
  $('#askBtn', root).onclick = doAsk;
  $('#askIn', root).onkeydown = (e) => { if (e.key === 'Enter') doAsk(); };
  const ap = $('#askPost', root); if (ap) ap.onclick = () => openWrite(root, 'question', cm.ask);

  $('#writeBtn', root).onclick = () => openWrite(root, 'tip');
}
function openWrite(root, type, title = '') {
  const dlg = $('#writeDlg', root); let wt = type;
  const setType = (t) => { wt = t; dlg.querySelectorAll('[data-wt]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.wt === t)); };
  setType(type); $('#wTitle', dlg).value = title;
  dlg.querySelectorAll('[data-wt]').forEach((b) => b.onclick = () => setType(b.dataset.wt));
  $('#wCancel', dlg).onclick = () => dlg.close();
  $('#writeForm', dlg).onsubmit = (e) => {
    e.preventDefault();
    const t = $('#wTitle', dlg).value.trim(), body = $('#wBody', dlg).value.trim();
    if (!t || !body) { toast('제목과 내용을 적어 주세요'); return; }
    const p = { id: uid(), type: wt, author: $('#wAuthor', dlg).value.trim() || '익명', senior: $('#wSenior', dlg).checked,
      crop: $('#wCrop', dlg).value, topic: $('#wTopic', dlg).value, createdAt: new Date().toISOString(), likes: 0,
      title: maskPersonal(t), body: maskPersonal(body) };
    S.posts.push(p); save(); dlg.close(); cm.open = p.id; cm.tab = 'all'; cm.topic = '전체'; cm.askResult = null;
    toast(wt === 'question' ? '질문을 올렸어요. 관련 노하우를 함께 보여 드려요.' : '노하우를 공유했어요'); render();
  };
  dlg.showModal();
}

/* ---------- 라우터 ---------- */
const VIEWS = {
  today: [viewToday, bindToday, '오늘', '☀️'],
  diagnose: [viewDiagnose, bindDiagnose, '진단', '📷'],
  log: [viewLog, bindLog, '기록', '📒'],
  machine: [viewMachine, bindMachine, '농기계', '🚜'],
  community: [viewCommunity, bindCommunity, '커뮤니티', '💬'],
};
function current() { const h = location.hash.slice(1); return VIEWS[h] ? h : 'today'; }
function render() {
  const k = current(); const [v, b] = VIEWS[k]; const root = $('#view');
  root.innerHTML = v(); b(root);
  document.querySelectorAll('.tabs button').forEach((t) => t.toggleAttribute('aria-current', false));
  document.querySelector(`.tabs button[data-go="${k}"]`)?.setAttribute('aria-current', 'page');
  const pill = $('#srcPill');
  if (weather) pill.textContent = weather.source === 'live' ? '날씨 실시간' : '날씨 스냅샷';
}
function mountTabs() {
  $('#tabs').innerHTML = Object.entries(VIEWS).map(([k, [, , l, i]]) => `<button data-go="${k}"><span class="i" aria-hidden="true">${i}</span>${l}</button>`).join('');
  document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { if (location.hash === '#' + b.dataset.go) render(); else location.hash = b.dataset.go; window.scrollTo(0, 0); });
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
$('#reset').onclick = () => { if (confirm('시연 데이터를 처음 상태로 되돌릴까요? 이 기기에 저장한 기록·글이 지워져요.')) { localStorage.removeItem(KEY); location.reload(); } };

(async () => {
  mountTabs();
  $('#view').innerHTML = '<div class="empty" style="padding:60px 0">불러오는 중…</div>';
  await initState();
  await loadWeather();
  render();
})();
