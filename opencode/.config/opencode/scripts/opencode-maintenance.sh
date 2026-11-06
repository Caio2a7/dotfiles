#!/usr/bin/env bash
# Manutenção automática do OpenCode: poda de sessões, checkpoint+VACUUM do SQLite
# e limpeza de dirs ad hoc em /tmp. Só age com o OpenCode ocioso.
#
# Uso: opencode-maintenance.sh [--dry-run] [--force]
#   --dry-run  só reporta o que seria feito (não toca no serviço nem apaga nada)
#   --force    ignora a trava "já rodou hoje" (a checagem de ociosidade continua)
set -uo pipefail

DB="${OPENCODE_DB:-$HOME/.local/share/opencode/opencode.db}"
OC="${OPENCODE_BIN:-$HOME/.opencode/bin/opencode}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}"
LOG="$STATE_DIR/opencode-maintenance.log"
LAST_RUN="$STATE_DIR/opencode-maintenance.last"
IDLE_MIN=20
CHILD_DAYS=21
ROOT_DAYS=60
MIN_INTERVAL_H=20
LOG_KEEP=500

DRY=0; FORCE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --force) FORCE=1 ;;
    *) echo "argumento desconhecido: $arg" >&2; exit 2 ;;
  esac
done

mkdir -p "$STATE_DIR"
log() { printf '%s %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG"; }
rotate_log() { [ -f "$LOG" ] && tail -n "$LOG_KEEP" "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"; }
trap rotate_log EXIT

exec 9>"${XDG_RUNTIME_DIR:-/tmp}/opencode-maintenance.lock"
flock -n 9 || { log "outra execução em andamento; saindo"; exit 0; }

sql() { sqlite3 -readonly -cmd ".timeout 5000" "$DB" "$1"; }
now_ms() { echo $(( $(date +%s) * 1000 )); }

is_idle() {
  local last cutoff
  last="$(sql 'select coalesce(max(time_created),0) from session_message')" || { log "erro lendo o DB; abortando"; return 1; }
  cutoff=$(( $(now_ms) - IDLE_MIN * 60000 ))
  if [ "$last" -gt "$cutoff" ]; then log "OpenCode ativo (mensagem nos últimos ${IDLE_MIN} min); tentará no próximo disparo"; return 1; fi
  local active
  active="$("$OC" api get /api/session/active 2>/dev/null | tr -d '[:space:]')" || active=""
  if [ -n "$active" ] && [ "$active" != '{"data":{}}' ]; then
    log "sessões em execução segundo a API; tentará no próximo disparo"; return 1
  fi
  return 0
}

already_done_recently() {
  [ "$FORCE" = 1 ] && return 1
  [ -f "$LAST_RUN" ] || return 1
  local age_h=$(( ( $(date +%s) - $(stat -c %Y "$LAST_RUN") ) / 3600 ))
  [ "$age_h" -lt "$MIN_INTERVAL_H" ]
}

# --- candidatos à poda -------------------------------------------------------
child_ids() {
  sql "select id from session_v2 where parent_id is not null
       and time_updated < $(now_ms) - $CHILD_DAYS*86400000"
}
root_ids() {
  sql "select s.id from session_v2 s where s.parent_id is null
       and s.time_updated < $(now_ms) - $ROOT_DAYS*86400000
       and coalesce((select max(c.time_updated) from session_v2 c where c.parent_id = s.id), 0) < $(now_ms) - $ROOT_DAYS*86400000"
}
estimate_bytes() {
  local ids="$1"
  [ -z "$ids" ] && { echo 0; return; }
  local list; list="$(printf "'%s'," $ids)"; list="${list%,}"
  sql "select (select coalesce(sum(length(data)),0) from session_message where session_id in ($list))
            + (select coalesce(sum(length(data)),0) from session_part where session_id in ($list))"
}

delete_sessions() {
  local ok=0 fail=0 id
  for id in "$@"; do
    if "$OC" api delete "/api/session/$id" >/dev/null 2>&1; then ok=$((ok+1)); else fail=$((fail+1)); fi
  done
  echo "$ok $fail"
}

prune() {
  local children roots nc nr bytes
  children="$(child_ids)"; roots="$(root_ids)"
  nc=$(printf '%s' "$children" | grep -c . || true); nr=$(printf '%s' "$roots" | grep -c . || true)
  bytes=$(( $(estimate_bytes "$children $roots") ))
  if [ "$DRY" = 1 ]; then
    log "[dry-run] podaria $nc sessões filhas (>${CHILD_DAYS}d) e $nr raiz (>${ROOT_DAYS}d); ~$((bytes/1048576)) MiB de dados de mensagens/partes"
    return
  fi
  local r1 r2
  # shellcheck disable=SC2086
  r1="$(delete_sessions $children)"; r2="$(delete_sessions $roots)"
  log "poda: filhas apagadas/falhas=$r1 de $nc; raízes apagadas/falhas=$r2 de $nr; ~$((bytes/1048576)) MiB estimados"
}

# --- VACUUM com serviço parado -----------------------------------------------
SERVICE_STOPPED=0
restart_service() {
  if [ "$SERVICE_STOPPED" = 1 ]; then
    "$OC" service start >/dev/null 2>&1 && log "serviço iniciado" || log "ERRO: falha ao iniciar o serviço"
    SERVICE_STOPPED=0
  fi
}

vacuum() {
  local before after
  before=$(stat -c %s "$DB")
  if [ "$DRY" = 1 ]; then
    log "[dry-run] faria service stop → wal_checkpoint(TRUNCATE)+VACUUM → service start (DB atual: $((before/1048576)) MiB)"
    return
  fi
  trap 'restart_service; rotate_log' EXIT
  "$OC" service stop >/dev/null 2>&1 || log "aviso: service stop retornou erro"
  SERVICE_STOPPED=1
  if sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE); VACUUM;" >/dev/null 2>&1; then
    after=$(stat -c %s "$DB")
    log "VACUUM ok: $((before/1048576)) MiB → $((after/1048576)) MiB"
  else
    log "ERRO: VACUUM falhou (DB intacto)"
  fi
  restart_service
}

# --- /tmp --------------------------------------------------------------------
clean_tmp() {
  local target
  while IFS= read -r target; do
    [ -z "$target" ] && continue
    if [ "$DRY" = 1 ]; then log "[dry-run] removeria $target"; else rm -rf -- "$target" && log "removido $target"; fi
  done < <(find /tmp -maxdepth 1 -user "$(id -un)" -mtime +2 \( -name td -o -name 'ana*.py' \) 2>/dev/null)
}

main() {
  log "início (dry-run=$DRY force=$FORCE)"
  if [ "$DRY" = 0 ] && already_done_recently; then log "já executado nas últimas ${MIN_INTERVAL_H}h; nada a fazer"; return 0; fi
  if [ "$DRY" = 1 ]; then is_idle || log "[dry-run] OpenCode ativo; execução real seria adiada"; else is_idle || return 0; fi
  prune
  vacuum
  clean_tmp
  [ "$DRY" = 0 ] && touch "$LAST_RUN"
  log "fim"
}
main
