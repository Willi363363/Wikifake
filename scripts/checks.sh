#!/usr/bin/env bash
# Contrôles de conformité du dépôt.
#
# Appelé par les hooks locaux (.githooks/) ET par la CI (.github/workflows/rules.yml).
# Une seule implémentation : un contrôle qui passe en local passe en CI, et
# inversement. Les règles appliquées sont documentées dans
# plans/methode/02-regles-du-depot.md.
#
# Usage : scripts/checks.sh <commande> [arguments]
#   staged                  contrôles sur les fichiers indexés (pre-commit)
#   diff <base> [head]      contrôles sur une plage de commits (CI)
#   commit-msg <fichier>    format du message de commit
#   branch <nom>            branche protégée + nomenclature
#   push <nom>              branche protégée (pre-push)
#   lint <fichiers...>      linters disponibles sur ces fichiers
set -uo pipefail

PROTECTED_BRANCHES='main master staging'
MAX_FILE_KB=1024
MAX_SOURCE_LINES=500
MAX_SUBJECT_LEN=72
DOC_MAX_LINES=200
ALLOWED_ROOT_DOCS='README.md CLAUDE.md CHANGELOG.md CONTRIBUTING.md SECURITY.md HANDOVER.md'
BRANCH_PATTERN='^([a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*|dependabot/.+|renovate/.+)$'

fail=0
err()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; fail=1; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }
info() { printf '  \033[2m·\033[0m %s\n' "$*"; }

is_text()      { [ -f "$1" ] && grep -Iq . "$1" 2>/dev/null; }
is_generated() { case "$1" in *package-lock.json|*pnpm-lock.yaml|*.min.*|*/dist/*|*.ico|*.png) return 0;; esac; return 1; }
is_test()      { case "$1" in *test*|*__tests__*|*spec*|scripts/*) return 0;; esac; return 1; }

# --- secrets ---------------------------------------------------------------
check_secrets() {
  for f in "$@"; do
    case "$f" in *.env.example|*.env.sample) continue;; esac
    case "$(basename "$f")" in .env|.env.*) err "$f : un fichier d'environnement ne se versionne jamais";; esac
    is_text "$f" || continue
    is_generated "$f" && continue
    while IFS= read -r pat; do
      [ -z "$pat" ] && continue
      if grep -nEq "$pat" "$f" 2>/dev/null; then
        err "$f : secret probable détecté ($(grep -nE "$pat" "$f" | head -1 | cut -d: -f1))"
      fi
    done <<'PATTERNS'
AIza[0-9A-Za-z_-]{35}
sk-ant-[A-Za-z0-9_-]{24,}
sk-[A-Za-z0-9]{32,}
gh[pousr]_[A-Za-z0-9]{36}
github_pat_[A-Za-z0-9_]{50,}
AKIA[0-9A-Z]{16}
xox[baprs]-[A-Za-z0-9-]{12,}
-----BEGIN [A-Z ]*PRIVATE KEY-----
PATTERNS
    # Affectation en dur d'un secret, hors gabarits et hors placeholders.
    if grep -nEq "(API_KEY|APIKEY|SECRET|TOKEN|PASSWORD)[A-Z_]*\s*[:=]\s*['\"][^'\"\$<{]{12,}['\"]" "$f" 2>/dev/null; then
      grep -nE "(API_KEY|APIKEY|SECRET|TOKEN|PASSWORD)[A-Z_]*\s*[:=]\s*['\"][^'\"\$<{]{12,}['\"]" "$f" \
        | grep -viE 'your_|dummy|example|placeholder|changeme|xxxx|test|fake' >/dev/null \
        && err "$f : secret écrit en dur — passez par une variable d'environnement"
    fi
  done
}

# --- hygiène ---------------------------------------------------------------
check_hygiene() {
  for f in "$@"; do
    [ -f "$f" ] || continue
    kb=$(( ($(wc -c <"$f") + 1023) / 1024 ))
    [ "$kb" -gt "$MAX_FILE_KB" ] && err "$f : ${kb} Ko (> ${MAX_FILE_KB} Ko) — un binaire lourd n'a pas sa place dans git"
    is_text "$f" || continue
    is_generated "$f" && continue
    grep -q $'\r' "$f" && err "$f : retours chariot CRLF"
    grep -nq ' $' "$f" && err "$f : espaces en fin de ligne ($(grep -n ' $' "$f" | head -1 | cut -d: -f1))"
    [ -n "$(tail -c1 "$f")" ] && err "$f : pas de saut de ligne final"
    case "$f" in
      *.py|*.js|*.jsx|*.ts|*.tsx)
        n=$(wc -l <"$f")
        [ "$n" -gt "$MAX_SOURCE_LINES" ] && err "$f : $n lignes (> $MAX_SOURCE_LINES) — à découper"
        ;;
    esac
  done
}

# --- journalisation --------------------------------------------------------
# Exigé depuis toujours par l'état des lieux : pas de print dans le code
# applicatif.
check_logging() {
  for f in "$@"; do
    [ -f "$f" ] && ! is_test "$f" || continue
    case "$f" in
      *.py)
        grep -nq '^\s*print(' "$f" && err "$f : print() interdit — utilisez le logger"
        ;;
      *.js|*.jsx|*.ts|*.tsx)
        case "$f" in *.config.*|*vite.config*) continue;; esac
        grep -nqE 'console\.(log|debug|info)\(' "$f" \
          && err "$f : console.log interdit — console.warn/error uniquement, ou un logger"
        ;;
    esac
  done
}

# --- documentation ---------------------------------------------------------
# Toute la documentation vit dans plans/, en fichiers de 200 lignes au plus.
# Une doc plus longue n'est pas relue, donc elle devient fausse.
check_docs() {
  local f n
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    n=$(wc -l <"$f")
    [ "$n" -gt "$DOC_MAX_LINES" ] && err "$f : $n lignes (> $DOC_MAX_LINES) — découpez en plusieurs fichiers de plans/"
    case "$f" in
      */*) ;;
      *)
        case " $ALLOWED_ROOT_DOCS " in
          *" $f "*) ;;
          *) err "$f : la documentation vit dans plans/, pas à la racine" ;;
        esac
        ;;
    esac
  done < <(find . -name '*.md' -not -path './.git/*' -not -path '*/node_modules/*' \
                  -not -path './venv/*' -not -path '*/.smoke/*' -printf '%P\n' 2>/dev/null | sort)
}

# --- linters disponibles ---------------------------------------------------
# Rien n'est installé de force : chaque linter tourne s'il est présent, et son
# absence est signalée. Le lot 0 de la refonte les rend tous disponibles.
check_lint() {
  local py=() js=()
  for f in "$@"; do
    [ -f "$f" ] || continue
    case "$f" in *.py) py+=("$f");; *.js|*.jsx|*.ts|*.tsx) js+=("$f");; esac
  done
  if [ ${#py[@]} -gt 0 ]; then
    if command -v ruff >/dev/null 2>&1; then
      ruff check -q "${py[@]}" || fail=1
    elif command -v python3 >/dev/null 2>&1; then
      for f in "${py[@]}"; do PYTHONDONTWRITEBYTECODE=1 python3 -m py_compile "$f" 2>&1 || err "$f : erreur de syntaxe"; done
      info "ruff absent — contrôle réduit à la syntaxe"
    fi
  fi
  if [ ${#js[@]} -gt 0 ]; then
    local eslint=''
    for c in node_modules/.bin/eslint frontend/node_modules/.bin/eslint; do
      [ -x "$c" ] && eslint="$c" && break
    done
    if [ -n "$eslint" ] && ls eslint.config.* .eslintrc* frontend/eslint.config.* >/dev/null 2>&1; then
      "$eslint" "${js[@]}" || fail=1
    else
      info "eslint non configuré — aucun contrôle sur ${#js[@]} fichier(s) JS/TS"
    fi
  fi
}

# --- message de commit -----------------------------------------------------
check_commit_msg() {
  local subject; subject=$(head -1 "$1")
  case "$subject" in
    Merge\ *|Revert\ *|fixup!\ *|squash!\ *) return 0;; # produits par git
  esac
  local re='^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9/_-]+\))?!?: .+'
  printf '%s' "$subject" | grep -qE "$re" \
    || err "sujet non conforme : « $subject »
      attendu : type(portée): description     ex. fix(realtime): purger l'état de manche
      types   : build chore ci docs feat fix perf refactor revert style test"
  [ "${#subject}" -gt "$MAX_SUBJECT_LEN" ] && err "sujet de ${#subject} caractères (> $MAX_SUBJECT_LEN)"
  case "$subject" in *.) err "sujet terminé par un point";; esac
}

# --- branches --------------------------------------------------------------
check_protected() {
  for b in $PROTECTED_BRANCHES; do
    [ "$1" = "$b" ] && err "« $1 » est protégée : aucun commit ni push direct, humain ou agent.
      git switch -c <auteur>/<sujet> puis ouvrez une pull request." && return
  done
}
check_branch_name() {
  printf '%s' "$1" | grep -qE "$BRANCH_PATTERN" \
    || err "nom de branche « $1 » non conforme — attendu <auteur>/<sujet>, en minuscules"
}

# --- collecte de fichiers --------------------------------------------------
staged_files() { git diff --cached --name-only --diff-filter=ACMR; }
diff_files()   { git diff --name-only --diff-filter=ACMR "$1" "${2:-HEAD}"; }

run_file_checks() {
  [ "$#" -eq 0 ] && { info 'aucun fichier à contrôler'; return; }
  check_secrets "$@"; check_hygiene "$@"; check_logging "$@"
}

case "${1:-}" in
  staged)
    branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo detached)
    check_protected "$branch"
    printf '%s' "$branch" | grep -qE "$BRANCH_PATTERN" || warn "nom de branche « $branch » non conforme (bloquant en CI)"
    mapfile -t files < <(staged_files)
    run_file_checks "${files[@]}"; check_docs; check_lint "${files[@]}"
    ;;
  diff)
    [ -z "${2:-}" ] && { echo 'usage: checks.sh diff <base> [head]' >&2; exit 2; }
    mapfile -t files < <(diff_files "$2" "${3:-HEAD}")
    run_file_checks "${files[@]}"; check_docs
    ;;
  commit-msg) check_commit_msg "${2:?fichier de message requis}" ;;
  branch)     check_protected "${2:?nom requis}"; check_branch_name "$2" ;;
  push)       check_protected "${2:?nom requis}" ;;
  lint)       shift; check_lint "$@" ;;
  *) echo 'usage: scripts/checks.sh {staged|diff|commit-msg|branch|push|lint} [args]' >&2; exit 2 ;;
esac

exit "$fail"
