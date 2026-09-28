"""formatter.py - ANSI and Markdown table rendering for quota inspection."""

from __future__ import annotations
import datetime
from typing import Any, Dict, List, Optional, Tuple
from quota_core.sources import fetch_claude_plan_status, fetch_openrouter_quota
from quota_core.detector import classify_model


def format_reset_time(iso_str: Optional[str]) -> str:
    """Formats ISO reset timestamp into relative and local time."""
    if not iso_str:
        return "N/D"
    try:
        dt = datetime.datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        secs = int((dt - datetime.datetime.now(datetime.timezone.utc)).total_seconds())
        if secs <= 0:
            return "✅ Resetado / Disponível"
        d, rem = divmod(secs, 86400)
        h, m = divmod(rem, 3600)
        p = ([f"{d}d"] if d else []) + ([f"{h}h"] if (h or d) else []) + [f"{m // 60}m"]
        return f"em {' '.join(p)} ({dt.astimezone().strftime('%d/%m %H:%M')})"
    except Exception:
        return iso_str


def format_percent(val: Optional[float]) -> str:
    """Formats quota percentage with clear status badges."""
    if val is None:
        return "N/D"
    try:
        n = float(val)
        b = "🔴" if n <= 10.0 else ("🟡" if n <= 40.0 else "🟢")
        return f"{b} {n:.1f}%"
    except Exception:
        return str(val)


def _render_claude_section(lines: List[str], is_active: bool) -> None:
    st = fetch_claude_plan_status()
    if st["status"] != "ok":
        lines.append(f"{'⚠️ ' if is_active else '- '}Plano Claude: {st['message']}.")
        return
    state = "🔴 Limite atingido" if st["limited"] else f"🟢 {st['state']}"
    util = st.get("utilization")
    util_txt = format_percent(100 - util * 100) if isinstance(util, (int, float)) else "N/D"
    if not is_active:
        lines.append(f"- **Plano Claude:** {state} | Reset: {format_reset_time(st['resets_at'])}.")
        return
    lines.extend(
        [
            "#### 🎯 Plano Claude (via opencode-claude)",
            "| Estado | Janela | Restante | Reset Previsto |",
            "| :--- | :---: | :---: | :--- |",
            f"| {state} | `{st.get('window') or 'N/D'}` | {util_txt} | {format_reset_time(st['resets_at'])} |",
            "",
        ]
    )


def _format_or_usage_limit(d: Dict[str, Any]) -> Tuple[str, str, str]:
    lbl = d.get("label", "Key")
    usage = f"${d.get('usage', 0):.4f}"
    lim = (
        f"${d.get('limit'):.2f}"
        if isinstance(d.get("limit"), (int, float))
        else "Sem limite"
    )
    return lbl, usage, lim


def _render_openrouter_details(
    lines: List[str], or_res: Dict[str, Any], is_active: bool
) -> None:
    st = or_res.get("status")
    if st == "not_configured":
        lines.append(
            "- **OpenRouter:** Chave não configurada no ambiente (`OPENROUTER_API_KEY`)."
            if not is_active
            else "⚠️ Nenhuma chave OpenRouter encontrada em `OPENROUTER_FREE_API_KEY` ou `OPENROUTER_API_KEY`."
        )
        return
    if st != "ok":
        lines.append(
            f"{'- ' if not is_active else '⚠️ '}OpenRouter: Erro ao verificar chave: {or_res.get('message')}"
        )
        return
    d = or_res.get("data", {})
    lbl, usage, lim = _format_or_usage_limit(d)
    if not is_active:
        lines.append(f"- **OpenRouter:** Chave `{lbl}` | Uso: `{usage}` / `{lim}`.")
        return
    reqs = d.get("rate_limit", {}).get("requests", "Padrão")
    free = "Sim" if d.get("is_free_tier") else "Não"
    lines.extend(
        [
            "#### 🎯 Status OpenRouter (Provedor Ativo)",
            "| Chave | Limite | Uso | Cota Free | Taxa / Limite |",
            "| :--- | :---: | :--- | :---: | :---: |",
            f"| `{lbl}` | {lim} | {usage} | {free} | {reqs} reqs |",
            "",
            "#### ℹ️ Outros Provedores",
        ]
    )
    _render_claude_section(lines, is_active=False)


def build_report(active: Dict[str, Any], forced_model: Optional[str] = None) -> str:
    """Builds the complete formatted quota report."""
    if forced_model:
        active["provider_id"], active["model_id"] = (
            forced_model.split("/", 1)
            if "/" in forced_model
            else (active["provider_id"], forced_model)
        )
    prov, grp, lbl = classify_model(active["provider_id"], active["model_id"])
    v = (
        f" (`{active['variant']}`)"
        if active.get("variant") and not forced_model
        else ""
    )
    lines = [
        f"### 📊 Relatório de Cota — Modelo Ativo: `{active['provider_id']}/{active['model_id']}`{v}",
        f"> **Provedor:** `{active['provider_id']}` | **Grupo de Cota:** `{lbl}`",
        "",
    ]
    if prov == "claude-code":
        _render_claude_section(lines, is_active=True)
        _render_openrouter_details(lines, fetch_openrouter_quota(), is_active=False)
    elif prov == "openrouter":
        _render_openrouter_details(lines, fetch_openrouter_quota(), is_active=True)
    else:
        lines.append(
            f"Provedor `{prov}` ativo. Nenhuma cota específica configurada para polling."
        )
    return "\n".join(lines)
