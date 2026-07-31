"""OpenRouter 無料モデル呼び出しヘルパー（DevX 自律ループ用）。

CAMEL を使うほど重くない1回限りのプロンプト（実装・評価）向け。
direct REST で OpenRouter に投げ、:free モデル / openrouter/free のみ使用する。
"""
import os
import json
import urllib.request
import urllib.error

BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openrouter/free"


def chat(
    system: str,
    user: str,
    *,
    model: str | None = None,
    max_tokens: int = 4000,
    temperature: float = 0.7,
    retries: int = 3,
) -> str:
    """システム + ユーザープロンプトで応答テキストを返す。"""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY が設定されていません")
    model = model or os.environ.get("CAMEL_MODEL", DEFAULT_MODEL)

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(BASE_URL, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices") or []
            if not choices:
                raise RuntimeError(f"応答に choices が無い: {data}")
            content = choices[0]["message"]["content"]
            return content if isinstance(content, str) else json.dumps(content)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")[:500]
            last_err = RuntimeError(f"HTTP {e.code}: {err_body}")
            if e.code in (429, 500, 502, 503):
                import time

                time.sleep(attempt * 5)
                continue
            raise last_err
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < retries:
                import time

                time.sleep(attempt * 5)
                continue
    raise RuntimeError(f"LLM 呼び出し失敗: {last_err}")


def extract_code_block(text: str, *, language: str | None = None) -> str | None:
    """```lang ... ``` ブロックの本文を取り出す。複数あれば先頭。"""
    import re

    if language:
        pattern = re.compile(r"```(?:%s)?\s*\n(.*?)```" % re.escape(language), re.DOTALL)
    else:
        pattern = re.compile(r"```[a-zA-Z0-9_+-]*\s*\n(.*?)```", re.DOTALL)
    m = pattern.search(text)
    return m.group(1) if m else None
