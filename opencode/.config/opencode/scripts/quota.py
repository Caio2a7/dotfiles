#!/usr/bin/env python3
"""
quota.py - Deterministic quota inspector for OpenCode.
Detects active model in use and outputs consolidated quota data.
"""

import argparse
import datetime
import json
import os
import sqlite3
import subprocess
import sys
import urllib.request

HOME = os.path.expanduser("~")
DB_PATH = os.path.join(HOME, ".local/share/opencode/opencode.db")
MODEL_STATE_PATH = os.path.join(HOME, ".local/state/opencode/model.json")
CONFIG_PATH = os.path.join(HOME, ".config/opencode/opencode.json")
ANTIGRAVITY_CONFIG_PATH = os.path.join(HOME, ".config/opencode/antigravity.json")
ANTIGRAVITY_ACCOUNTS_PATH = os.path.join(
    HOME, ".config/opencode/antigravity-accounts.json"
)


def detect_active_model():
    """Detects active provider, model ID, and variant from OpenCode state."""
    # 1. Try SQLite database
    if os.path.exists(DB_PATH):
        try:
            con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=1.0)
            cur = con.cursor()
            cwd = os.getcwd()

            # Prefer session matching current directory
            cur.execute(
                "SELECT model FROM session WHERE directory = ? AND model IS NOT NULL ORDER BY time_updated DESC LIMIT 1;",
                (cwd,),
            )
            row = cur.fetchone()

            if not row or not row[0]:
                cur.execute(
                    "SELECT model FROM session WHERE model IS NOT NULL ORDER BY time_updated DESC LIMIT 1;"
                )
                row = cur.fetchone()

            if row and row[0]:
                data = json.loads(row[0])
                if isinstance(data, dict) and data.get("id"):
                    return {
                        "provider_id": data.get("providerID", "unknown"),
                        "model_id": data.get("id"),
                        "variant": data.get("variant"),
                        "source": "session",
                    }

            # If session.model was null, check latest message
            cur.execute(
                "SELECT data FROM message WHERE data IS NOT NULL ORDER BY time_created DESC LIMIT 1;"
            )
            row = cur.fetchone()
            if row and row[0]:
                msg_data = json.loads(row[0])
                if msg_data.get("modelID") and msg_data.get("providerID"):
                    return {
                        "provider_id": msg_data.get("providerID"),
                        "model_id": msg_data.get("modelID"),
                        "variant": None,
                        "source": "message",
                    }
        except Exception:
            pass

    # 2. Try model.json (recent list)
    if os.path.exists(MODEL_STATE_PATH):
        try:
            with open(MODEL_STATE_PATH, "r", encoding="utf-8") as f:
                state = json.load(f)
                recent = state.get("recent", [])
                if recent and isinstance(recent, list):
                    item = recent[0]
                    return {
                        "provider_id": item.get("providerID", "unknown"),
                        "model_id": item.get("modelID", "unknown"),
                        "variant": None,
                        "source": "recent_models",
                    }
        except Exception:
            pass

    # 3. Fallback to opencode.json default model
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                def_model = cfg.get("model", "")
                if "/" in def_model:
                    prov, mid = def_model.split("/", 1)
                    return {
                        "provider_id": prov,
                        "model_id": mid,
                        "variant": None,
                        "source": "config",
                    }
        except Exception:
            pass

    return {
        "provider_id": "google",
        "model_id": "antigravity-gemini-3.8-flash",
        "variant": None,
        "source": "default",
    }


def classify_model(provider_id: str, model_id: str):
    """Categorizes model into provider and quota group."""
    mid = (model_id or "").lower()
    pid = (provider_id or "").lower()

    if pid == "google" or "antigravity" in pid:
        if "gemini" in mid:
            return "google", "gemini", "Gemini"
        elif any(k in mid for k in ["claude", "sonnet", "opus", "haiku"]):
            return "google", "non-gemini", "Claude (Non-Gemini)"
        elif "gpt" in mid or "oss" in mid:
            return "google", "non-gemini", "GPT-OSS (Non-Gemini)"
        else:
            return "google", "non-gemini", "Non-Gemini"
    elif "openrouter" in pid or any(
        k in mid for k in ["minimax", "qwen", "llama", "glm", "nousresearch"]
    ):
        return "openrouter", "openrouter", "OpenRouter"
    else:
        return pid, "default", provider_id


from typing import Any, Optional


def format_reset_time(iso_str: Optional[str]) -> str:
    """Formats ISO reset timestamp into human-readable relative and local time."""
    if not iso_str:
        return "N/D"
    try:
        dt = datetime.datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        now = datetime.datetime.now(datetime.timezone.utc)
        diff = dt - now
        total_seconds = int(diff.total_seconds())

        if total_seconds <= 0:
            return "✅ Resetado / Disponível"

        days = total_seconds // 86400
        hours = (total_seconds % 86400) // 3600
        mins = (total_seconds % 3600) // 60

        parts = []
        if days > 0:
            parts.append(f"{days}d")
        if hours > 0 or days > 0:
            parts.append(f"{hours}h")
        parts.append(f"{mins}m")
        rel = " ".join(parts)

        local_dt = dt.astimezone()
        local_str = local_dt.strftime("%d/%m %H:%M")
        return f"em {rel} ({local_str})"
    except Exception:
        return iso_str


def format_percent(val: Optional[float]) -> str:
    """Formats quota percentage with clear status badges."""
    if val is None:
        return "N/D"
    try:
        num = float(val)
        if num <= 10.0:
            badge = "🔴"
        elif num <= 40.0:
            badge = "🟡"
        else:
            badge = "🟢"
        return f"{badge} {num:.1f}%"
    except Exception:
        return str(val)


def fetch_antigravity_quota():
    """Fetches Antigravity quota via CLI refresh or cached accounts file."""
    # 1. Try running antigravity-auth quota CLI
    try:
        proc = subprocess.run(
            [
                "npx",
                "-y",
                "@cortexkit/opencode-antigravity-auth",
                "quota",
                "--refresh",
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=8,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            data = json.loads(proc.stdout)
            if "accounts" in data:
                return data["accounts"], "live"
    except Exception:
        pass

    # 2. Fallback to cached accounts file
    if os.path.exists(ANTIGRAVITY_ACCOUNTS_PATH):
        try:
            with open(ANTIGRAVITY_ACCOUNTS_PATH, "r", encoding="utf-8") as f:
                acc_data = json.load(f)
                accounts = []
                for i, acc in enumerate(acc_data.get("accounts", []), 1):
                    cq = acc.get("cachedQuota", {})
                    groups = []
                    for gname in ["gemini", "non-gemini"]:
                        gdata = cq.get(gname, {})
                        rem = gdata.get("remainingFraction")
                        pct = rem * 100.0 if rem is not None else 100.0
                        groups.append(
                            {
                                "name": gname,
                                "remainingPercent": pct,
                                "resetTime": gdata.get("resetTime"),
                            }
                        )
                    accounts.append(
                        {
                            "index": i,
                            "email": acc.get("email"),
                            "status": "ok" if acc.get("enabled", True) else "disabled",
                            "groups": groups,
                            "lastUsed": acc.get("lastUsed", 0),
                        }
                    )
                return accounts, "cached"
        except Exception:
            pass

    return [], "failed"


def get_antigravity_meta():
    """Returns primary account and active account metadata."""
    primary_email = ""
    if os.path.exists(ANTIGRAVITY_CONFIG_PATH):
        try:
            with open(ANTIGRAVITY_CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                primary_email = cfg.get("gemini_primary_account", "")
        except Exception:
            pass

    last_used_email = ""
    highest_time = 0
    if os.path.exists(ANTIGRAVITY_ACCOUNTS_PATH):
        try:
            with open(ANTIGRAVITY_ACCOUNTS_PATH, "r", encoding="utf-8") as f:
                acc_data = json.load(f)
                for acc in acc_data.get("accounts", []):
                    lu = acc.get("lastUsed", 0)
                    if lu > highest_time:
                        highest_time = lu
                        last_used_email = acc.get("email", "")
        except Exception:
            pass

    return primary_email, last_used_email


def fetch_openrouter_quota():
    """Checks OpenRouter quota via API if key is present."""
    key = os.environ.get("OPENROUTER_FREE_API_KEY") or os.environ.get(
        "OPENROUTER_API_KEY"
    )
    if not key and os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                key = (
                    cfg.get("provider", {})
                    .get("openrouter-free", {})
                    .get("options", {})
                    .get("apiKey")
                )
                if key and key.startswith("{env:") and key.endswith("}"):
                    var = key[5:-1]
                    key = os.environ.get(var)
        except Exception:
            pass

    if not key or not str(key).strip():
        return {"status": "not_configured"}

    try:
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/auth/key",
            headers={
                "Authorization": f"Bearer {key.strip()}",
                "User-Agent": "OpenCode/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            return {"status": "ok", "data": data.get("data", {})}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def main():
    parser = argparse.ArgumentParser(
        description="Deterministic Quota Inspector for OpenCode"
    )
    parser.add_argument(
        "--model", help="Force specific model check instead of auto-detect"
    )
    raw_args = [a for a in sys.argv[1:] if a.strip()]
    args = parser.parse_args(raw_args)

    active = detect_active_model()
    if args.model:
        if "/" in args.model:
            active["provider_id"], active["model_id"] = args.model.split("/", 1)
        else:
            active["model_id"] = args.model

    prov, group, group_label = classify_model(active["provider_id"], active["model_id"])

    lines = []
    variant_str = (
        f" (`{active['variant']}`)" if active.get("variant") and not args.model else ""
    )
    lines.append(
        f"### 📊 Relatório de Cota — Modelo Ativo: `{active['provider_id']}/{active['model_id']}`{variant_str}"
    )
    lines.append(
        f"> **Provedor:** `{active['provider_id']}` | **Grupo de Cota:** `{group_label}`"
    )
    lines.append("")

    primary_acc, last_used_acc = get_antigravity_meta()

    if prov == "google":
        accounts, fetch_mode = fetch_antigravity_quota()
        if not accounts:
            lines.append(
                "⚠️ Não foi possível consultar as cotas do Google / Antigravity."
            )
        else:
            # Sort accounts: primary first, then last_used, then remainingPercent desc
            def sort_key(acc):
                email = acc.get("email", "")
                is_primary = (
                    1 if (email == primary_acc or email == last_used_acc) else 0
                )
                rem = 0
                for g in acc.get("groups", []):
                    if g.get("name") == group:
                        rem = g.get("remainingPercent", 0)
                return (-is_primary, -rem)

            accounts_sorted = sorted(accounts, key=sort_key)

            lines.append(f"#### 🎯 Cotas para o Grupo Ativo: **{group_label}**")
            lines.append("| Conta | Cota Restante | Reset Previsto | Papel |")
            lines.append("| :--- | :---: | :--- | :---: |")

            other_group = "non-gemini" if group == "gemini" else "gemini"
            other_label = (
                "Claude & GPT-OSS (Non-Gemini)" if group == "gemini" else "Gemini"
            )
            other_total_rem = 0
            other_count = 0

            for acc in accounts_sorted:
                email = acc.get("email", "")
                badges = []
                if email == primary_acc:
                    badges.append("★ Primária")
                elif email == last_used_acc:
                    badges.append("⚡ Ativa")

                role_str = " ".join(badges) if badges else "—"

                rem_pct = None
                reset_t = None

                for g in acc.get("groups", []):
                    if g.get("name") == group:
                        rem_pct = g.get("remainingPercent")
                        reset_t = g.get("resetTime")
                    elif g.get("name") == other_group:
                        other_total_rem += g.get("remainingPercent", 0)
                        other_count += 1

                account_display = f"**{email}**" if badges else f"`{email}`"
                lines.append(
                    f"| {account_display} | {format_percent(rem_pct)} | {format_reset_time(reset_t)} | {role_str} |"
                )

            lines.append("")
            # Compact summary of the other Google group
            if other_count > 0:
                avg_other = other_total_rem / other_count
                lines.append("#### ℹ️ Outros Grupos e Provedores")
                lines.append(
                    f"- **Google {other_label}:** {other_count} contas disponíveis (Média: **{avg_other:.1f}%** restante)."
                )

        # OpenRouter status
        or_res = fetch_openrouter_quota()
        if or_res.get("status") == "not_configured":
            lines.append(
                "- **OpenRouter:** Chave não configurada no ambiente (`OPENROUTER_API_KEY`)."
            )
        elif or_res.get("status") == "ok":
            data_raw = or_res.get("data")
            d: dict[str, Any] = data_raw if isinstance(data_raw, dict) else {}
            label = d.get("label", "Key")
            usage = d.get("usage", 0)
            limit = d.get("limit", "Sem limite")
            lines.append(
                f"- **OpenRouter:** Chave `{label}` | Uso: `${usage:.4f}` / `${limit}`."
            )
        else:
            lines.append(
                f"- **OpenRouter:** Erro ao verificar chave: {or_res.get('message')}"
            )

    elif prov == "openrouter":
        lines.append("#### 🎯 Status OpenRouter (Provedor Ativo)")
        or_res = fetch_openrouter_quota()
        if or_res.get("status") == "not_configured":
            lines.append(
                "⚠️ Nenhuma chave OpenRouter encontrada em `OPENROUTER_FREE_API_KEY` ou `OPENROUTER_API_KEY`."
            )
        elif or_res.get("status") == "ok":
            data_raw = or_res.get("data")
            d_or: dict[str, Any] = data_raw if isinstance(data_raw, dict) else {}
            lines.append("| Chave | Limite | Uso | Cota Free | Taxa / Limite |")
            lines.append("| :--- | :---: | :---: | :---: | :---: |")
            label = d_or.get("label", "Ativa")
            raw_lim = d_or.get("limit")
            limit = (
                f"${raw_lim:.2f}" if isinstance(raw_lim, (int, float)) else "Sem limite"
            )
            usage = f"${d_or.get('usage', 0):.4f}"
            free = "Sim" if d_or.get("is_free_tier") else "Não"
            rl_raw = d_or.get("rate_limit")
            rl = (
                rl_raw.get("requests", "Padrão")
                if isinstance(rl_raw, dict)
                else "Padrão"
            )
            lines.append(f"| `{label}` | {limit} | {usage} | {free} | {rl} reqs |")
        else:
            lines.append(f"⚠️ Erro ao consultar OpenRouter: {or_res.get('message')}")

        lines.append("")
        lines.append("#### ℹ️ Google / Antigravity (Secundário)")
        accounts, _ = fetch_antigravity_quota()
        if accounts:
            lines.append(
                f"- **Antigravity:** {len(accounts)} contas conectadas prontas para uso."
            )
    else:
        lines.append(
            f"Provedor `{prov}` ativo. Nenhuma cota específica configurada para polling."
        )

    print("\n".join(lines))


if __name__ == "__main__":
    main()
