#!/usr/bin/env bash
# Repository conformance checks.
#
# Called by the local hooks (.githooks/) AND by CI (.github/workflows/rules.yml).
# One implementation: a check that passes locally passes in CI, and the other
# way round. The rules it enforces are documented in
# plans/method/02-repository-rules.md.
#
# Usage: scripts/checks.sh <command> [arguments]
#   staged                  checks on staged files (pre-commit)
#   diff <base> [head]      checks over a commit range (CI)
#   commit-msg <file>       commit message format
#   branch <name>           protected branch + naming
#   push <name>             protected branch (pre-push)
#   lint <files...>         available linters on these files
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
    case "$(basename "$f")" in .env|.env.*) err "$f: an environment file is never versioned";; esac
    is_text "$f" || continue
    is_generated "$f" && continue
    while IFS= read -r pat; do
      [ -z "$pat" ] && continue
      if grep -nEq "$pat" "$f" 2>/dev/null; then
        err "$f: likely secret detected (line $(grep -nE "$pat" "$f" | head -1 | cut -d: -f1))"
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
    # Hardcoded secret assignment, excluding templates and placeholders.
    if grep -nEq "(API_KEY|APIKEY|SECRET|TOKEN|PASSWORD)[A-Z_]*[[:space:]]*[:=][[:space:]]*['\"][^'\"\$<{]{12,}['\"]" "$f" 2>/dev/null; then
      grep -nE "(API_KEY|APIKEY|SECRET|TOKEN|PASSWORD)[A-Z_]*[[:space:]]*[:=][[:space:]]*['\"][^'\"\$<{]{12,}['\"]" "$f" \
        | grep -viE 'your_|dummy|example|placeholder|changeme|xxxx|test|fake' >/dev/null \
        && err "$f: hardcoded secret — use an environment variable"
    fi
  done
}

# --- hygiene ---------------------------------------------------------------
check_hygiene() {
  for f in "$@"; do
    [ -f "$f" ] || continue
    kb=$(( ($(wc -c <"$f") + 1023) / 1024 ))
    [ "$kb" -gt "$MAX_FILE_KB" ] && err "$f: ${kb} KB (> ${MAX_FILE_KB} KB) — a heavy binary does not belong in git"
    is_text "$f" || continue
    is_generated "$f" && continue
    grep -q $'\r' "$f" && err "$f: CRLF line endings"
    grep -nq ' $' "$f" && err "$f: trailing whitespace (line $(grep -n ' $' "$f" | head -1 | cut -d: -f1))"
    [ -n "$(tail -c1 "$f")" ] && err "$f: missing final newline"
    case "$f" in
      *.py|*.js|*.jsx|*.ts|*.tsx)
        n=$(wc -l <"$f")
        [ "$n" -gt "$MAX_SOURCE_LINES" ] && err "$f: $n lines (> $MAX_SOURCE_LINES) — split it"
        ;;
    esac
  done
}

# --- logging ---------------------------------------------------------------
# Required since forever by the current-state docs: no print in application code.
check_logging() {
  for f in "$@"; do
    [ -f "$f" ] && ! is_test "$f" || continue
    case "$f" in
      *.py)
        grep -nq '^[[:space:]]*print(' "$f" && err "$f: print() is forbidden — use the logger"
        ;;
      *.js|*.jsx|*.ts|*.tsx)
        case "$f" in *.config.*|*vite.config*) continue;; esac
        grep -nqE 'console\.(log|debug|info)\(' "$f" \
          && err "$f: console.log is forbidden — console.warn/error only, or a logger"
        ;;
    esac
  done
}

# --- documentation ---------------------------------------------------------
# All documentation lives in plans/, in files of at most 200 lines. Longer
# documentation does not get reread, so it becomes wrong.
check_docs() {
  local f n
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    n=$(wc -l <"$f")
    [ "$n" -gt "$DOC_MAX_LINES" ] && err "$f: $n lines (> $DOC_MAX_LINES) — split it across plans/ files"
    case "$f" in
      */*) ;;
      *)
        case " $ALLOWED_ROOT_DOCS " in
          *" $f "*) ;;
          *) err "$f: documentation lives in plans/, not at the root" ;;
        esac
        ;;
    esac
  done < <(find . -name '*.md' -not -path './.git/*' -not -path '*/node_modules/*' \
                  -not -path './venv/*' -not -path '*/.smoke/*' -print 2>/dev/null \
             | sed 's|^\./||' | sort)
}

# --- available linters -----------------------------------------------------
# Nothing is force-installed: each linter runs if present, and its absence is
# reported rather than silently skipped.
# The Python branch left with the Python in step 10.9: there is no `.py` in the
# repository any more, and a linter that can no longer be reached is a linter
# nobody will notice has stopped running.
check_lint() {
  local js=()
  for f in "$@"; do
    [ -f "$f" ] || continue
    case "$f" in *.js|*.jsx|*.ts|*.tsx) js+=("$f");; esac
  done
  if [ ${#js[@]} -gt 0 ]; then
    local eslint='' config=''
    for c in node_modules/.bin/eslint; do
      [ -x "$c" ] && eslint="$c" && break
    done
    # An `ls` over several patterns fails as soon as one is missing: test each
    # candidate separately.
    for c in eslint.config.js eslint.config.mjs eslint.config.ts .eslintrc.json .eslintrc.js; do
      [ -f "$c" ] && config="$c" && break
    done
    if [ -n "$eslint" ] && [ -n "$config" ]; then
      "$eslint" "${js[@]}" || fail=1
    else
      info "eslint not configured — no check on ${#js[@]} JS/TS file(s)"
    fi
  fi
}

# --- commit message --------------------------------------------------------
check_commit_msg() {
  local subject; subject=$(head -1 "$1")
  case "$subject" in
    Merge\ *|Revert\ *|fixup!\ *|squash!\ *) return 0;; # produced by git
  esac
  local re='^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9/_-]+\))?!?: .+'
  printf '%s' "$subject" | grep -qE "$re" \
    || err "non-conforming subject: \"$subject\"
      expected: type(scope): description     e.g. fix(realtime): reset round state
      types   : build chore ci docs feat fix perf refactor revert style test"
  [ "${#subject}" -gt "$MAX_SUBJECT_LEN" ] && err "subject is ${#subject} characters (> $MAX_SUBJECT_LEN)"
  case "$subject" in *.) err "subject ends with a period";; esac
}

# --- branches --------------------------------------------------------------
check_protected() {
  for b in $PROTECTED_BRANCHES; do
    [ "$1" = "$b" ] && err "\"$1\" is protected: no direct commit or push, human or agent.
      git switch -c <type>/<subject>, then open a pull request." && return
  done
}
check_branch_name() {
  printf '%s' "$1" | grep -qE "$BRANCH_PATTERN" \
    || err "branch name \"$1\" is not conforming — expected <type>/<subject>, lowercase"
}

# --- file collection -------------------------------------------------------
# `mapfile` is a bash 4+ builtin and `find -printf` is a GNU extension: neither
# exists on a default macOS (bash 3.2 + BSD find). The hooks must work there
# too, or the "rules enforced locally" promise only holds on Linux.
staged_files() { git diff --cached --name-only --diff-filter=ACMR; }
diff_files()   { git diff --name-only --diff-filter=ACMR "$1" "${2:-HEAD}"; }
read_lines()   { files=(); while IFS= read -r line; do [ -n "$line" ] && files+=("$line"); done; }

run_file_checks() {
  [ "$#" -eq 0 ] && { info 'no file to check'; return; }
  check_secrets "$@"; check_hygiene "$@"; check_logging "$@"
}

case "${1:-}" in
  staged)
    branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo detached)
    check_protected "$branch"
    printf '%s' "$branch" | grep -qE "$BRANCH_PATTERN" || warn "branch name \"$branch\" is not conforming (blocking in CI)"
    read_lines < <(staged_files)
    run_file_checks "${files[@]}"; check_docs; check_lint "${files[@]}"
    ;;
  diff)
    [ -z "${2:-}" ] && { echo 'usage: checks.sh diff <base> [head]' >&2; exit 2; }
    read_lines < <(diff_files "$2" "${3:-HEAD}")
    run_file_checks "${files[@]}"; check_docs
    ;;
  commit-msg) check_commit_msg "${2:?message file required}" ;;
  branch)     check_protected "${2:?name required}"; check_branch_name "$2" ;;
  push)       check_protected "${2:?name required}" ;;
  lint)       shift; check_lint "$@" ;;
  *) echo 'usage: scripts/checks.sh {staged|diff|commit-msg|branch|push|lint} [args]' >&2; exit 2 ;;
esac

exit "$fail"
