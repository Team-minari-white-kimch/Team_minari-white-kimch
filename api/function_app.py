"""Azure Static Web Apps 관리형 Functions (Python v2 모델).

- GET  /api/health           상태 확인 (에이전트 연결 여부)
- POST /api/diagnose         사진 특징 → 진단 에이전트 → 검증 에이전트
- POST /api/community/ask    질문 → 관련 노하우(원문 문장만)

COPILOT_GITHUB_TOKEN이 없거나 에이전트가 실패하면 503을 돌려준다.
웹앱은 503을 받으면 앱 안 규칙으로 대신하고 화면에 그렇게 표시한다.
"""
import asyncio
import json
import logging
import time

import azure.functions as func

import agents

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
log = logging.getLogger("farm-api")
MAX_BODY = 3_000_000


def _resp(obj, status=200):
    return func.HttpResponse(json.dumps(obj, ensure_ascii=False), status_code=status, mimetype="application/json")


def _body(req: func.HttpRequest):
    raw = req.get_body() or b""
    if len(raw) > MAX_BODY:
        raise ValueError("too large")
    return json.loads(raw or b"{}")


@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return _resp({"ok": True, "agent": agents.enabled(), "models": [agents.DIAG_MODEL, agents.JUDGE_MODEL]})


@app.route(route="diagnose", methods=["POST"])
async def diagnose(req: func.HttpRequest) -> func.HttpResponse:
    if not agents.enabled():
        return _resp({"error": "agent not configured"}, 503)
    try:
        b = _body(req)
        crop = str(b.get("crop", ""))[:20]
        symptoms = [str(s)[:40] for s in (b.get("symptoms") or [])][:20]
        stats = b.get("stats") if isinstance(b.get("stats"), dict) else None
        t0 = time.time()
        out = await asyncio.wait_for(agents.diagnose(crop, symptoms, stats), timeout=agents.TIMEOUT + 30)
        log.info("diagnose ok crop=%s n=%d top=%d %.1fs", crop, len(symptoms), len(out["top"]), time.time() - t0)
        return _resp(out)
    except Exception as ex:  # 실패는 기록하고 웹앱이 대체하게 한다
        log.exception("diagnose failed: %s", ex)
        return _resp({"error": "agent failed"}, 503)


@app.route(route="community/ask", methods=["POST"])
async def community_ask(req: func.HttpRequest) -> func.HttpResponse:
    if not agents.enabled():
        return _resp({"error": "agent not configured"}, 503)
    try:
        b = _body(req)
        out = await asyncio.wait_for(agents.ask(str(b.get("question", "")), b.get("posts") or []), timeout=agents.TIMEOUT + 30)
        log.info("ask ok items=%d", len(out["items"]))
        return _resp(out)
    except Exception as ex:
        log.exception("ask failed: %s", ex)
        return _resp({"error": "agent failed"}, 503)
