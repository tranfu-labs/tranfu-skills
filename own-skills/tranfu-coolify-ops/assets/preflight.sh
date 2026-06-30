#!/usr/bin/env bash
# preflight.sh — tranfu-coolify-ops 部署前全部前置检测
#
# 用法:
#   ./preflight.sh                                     # cwd 已在 repo, 默认 BASE
#   ./preflight.sh https://github.com/tranfu-labs/foo  # 给 GitHub URL, cwd 不在 repo 也行 (软警告)
#   ./preflight.sh https://github.com/tranfu-labs/foo http://my-coolify:8000
#   ./preflight.sh http://my-coolify:8000              # 只覆盖 BASE, 走旧 cwd 检查
#
# 工作目录:
#   - 不传 GITHUB_URL: cwd 必须在 git 仓库根 (硬 check)
#   - 传了 GITHUB_URL: cwd 不必匹配 — Step 2I 会 mktemp clone (软警告)
#
# 退出码:
#   0  全部 ✓                       → 安全进 reconcile flow
#   1  任一硬 check ✗               → 修完再来
#   2  仅手工 ack 未通过 (其它都过)  → ack 即可
#
# 安全纪律:
#   - 永远不打印 $COOLIFY_API_TOKEN 任何字节 (长度 / 前缀都不打)
#   - 失败原因只描述"哪一层挂了", 不暴露 token
#   - 非交互环境 (CI / pipe) 自动跳过 ack 算 ⚠

set -u

# 参数解析: 第一个参数含 github.com 当 GITHUB_URL, 否则当 BASE
GITHUB_URL=""
BASE=""
case "${1:-}" in
  *github.com*) GITHUB_URL="$1"; BASE="${2:-http://120.77.223.183:8000}" ;;
  "")           BASE="http://120.77.223.183:8000" ;;
  *)            BASE="$1" ;;
esac
BASE="${BASE:-http://120.77.223.183:8000}"

# 从 GITHUB_URL 解析期望的 org/name (若给了)
EXPECTED_ORG=""
EXPECTED_NAME=""
if [ -n "$GITHUB_URL" ]; then
  URL_CLEAN="${GITHUB_URL%.git}"
  URL_CLEAN="${URL_CLEAN%/}"
  case "$URL_CLEAN" in
    *github.com:*) URL_PATH="${URL_CLEAN#*github.com:}" ;;
    *github.com/*) URL_PATH="${URL_CLEAN#*github.com/}" ;;
    *)             URL_PATH="" ;;
  esac
  if [ -n "$URL_PATH" ]; then
    EXPECTED_ORG="${URL_PATH%%/*}"
    EXPECTED_NAME="${URL_PATH##*/}"
  fi
fi

PASS=0; FAIL=0; MANUAL=0
ok()     { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail()   { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
manual() { echo "  ⚠ $1"; MANUAL=$((MANUAL+1)); }

echo "Tranfu Coolify Ops · preflight check"
echo "===================================="

# ---------- 工具 ----------
echo
echo "▸ 工具"
MISSING_TOOLS=()
for t in gh jq curl git base64; do
  if command -v "$t" >/dev/null 2>&1; then
    :
  else
    MISSING_TOOLS+=("$t")
  fi
done
if [ ${#MISSING_TOOLS[@]} -eq 0 ]; then
  ok "gh / jq / curl / git / base64"
else
  fail "缺工具: ${MISSING_TOOLS[*]} (macOS: brew install ${MISSING_TOOLS[*]})"
fi

# ---------- Git 仓库状态 ----------
echo
echo "▸ Git 仓库状态"

# 软/硬 check 分流: 传了 GITHUB_URL → 走"软检查模式"(Step 2I 会 mktemp clone, cwd 不在 repo 是合法状态)
SOFT_MODE=0
if [ -n "$GITHUB_URL" ]; then
  SOFT_MODE=1
  echo "  (软检查模式: 传了 GITHUB_URL=$GITHUB_URL, cwd 不在 repo 只 ⚠ 不 ✗)"
fi

# 先校验 GITHUB_URL 本身合规 (若传了)
if [ -n "$GITHUB_URL" ]; then
  if [ -z "$EXPECTED_ORG" ] || [ -z "$EXPECTED_NAME" ]; then
    fail "GITHUB_URL 解析失败: $GITHUB_URL (期望 https://github.com/<org>/<repo>)"
  else
    if [ "$EXPECTED_ORG" = "tranfu-labs" ]; then
      ok "GITHUB_URL org = tranfu-labs ($EXPECTED_ORG/$EXPECTED_NAME)"
    else
      fail "GITHUB_URL org=$EXPECTED_ORG (期望 tranfu-labs)"
    fi
    if echo "$EXPECTED_NAME" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*-app$'; then
      ok "GITHUB_URL 命名合规 (烤肉串-app, 全小写)"
    else
      fail "GITHUB_URL 命名不合规: $EXPECTED_NAME (期望 烤肉串-app 形式)"
    fi
  fi
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -n "$REPO_ROOT" ]; then
  ok "cwd 在 git 仓库: $REPO_ROOT"
elif [ "$SOFT_MODE" = "1" ]; then
  manual "cwd 不在 git 仓库 (软检查通过: Step 2I 会 mktemp 临时 clone)"
else
  fail "当前 cwd 不在 git 仓库 (cd 到仓库根再跑, 或传 GITHUB_URL 进入软检查模式)"
fi

REPO_ORG=""; REPO_NAME=""
if [ -n "$REPO_ROOT" ]; then
  ORIGIN=$(git remote get-url origin 2>/dev/null || true)
  if [ -n "$ORIGIN" ]; then
    ORIGIN_CLEAN="${ORIGIN%.git}"
    ORIGIN_CLEAN="${ORIGIN_CLEAN%/}"
    case "$ORIGIN_CLEAN" in
      *github.com:*) REPO_PATH="${ORIGIN_CLEAN#*github.com:}" ;;
      *github.com/*) REPO_PATH="${ORIGIN_CLEAN#*github.com/}" ;;
      *)             REPO_PATH="" ;;
    esac

    if [ -n "$REPO_PATH" ]; then
      REPO_ORG="${REPO_PATH%%/*}"
      REPO_NAME="${REPO_PATH##*/}"
      if [ -n "$REPO_ORG" ] && [ -n "$REPO_NAME" ] && [ "$REPO_ORG" != "$REPO_NAME" ]; then
        ok "cwd origin: $REPO_ORG/$REPO_NAME"

        # 若传了 GITHUB_URL, 比对 cwd 是否就是目标 repo
        if [ -n "$EXPECTED_ORG" ] && [ -n "$EXPECTED_NAME" ]; then
          if [ "$REPO_ORG" = "$EXPECTED_ORG" ] && [ "$REPO_NAME" = "$EXPECTED_NAME" ]; then
            ok "cwd repo 与 GITHUB_URL 匹配"
          else
            manual "cwd 在 $REPO_ORG/$REPO_NAME, 但 GITHUB_URL 指向 $EXPECTED_ORG/$EXPECTED_NAME (软检查: Step 2I 会 mktemp clone 目标 repo)"
          fi
        fi
      else
        fail "cwd origin URL 解析失败: $ORIGIN"
        REPO_ORG=""; REPO_NAME=""
      fi
    else
      fail "cwd origin 不是 GitHub URL: $ORIGIN"
    fi
  elif [ "$SOFT_MODE" = "0" ]; then
    fail "cwd 无 origin remote (git remote add origin <url>, 或传 GITHUB_URL 进入软检查模式)"
  fi

  # 命名合规 (仅当 cwd 在 repo 且 GITHUB_URL 没给时强校验; 给了 GITHUB_URL 已经在前面校验过期望命名)
  if [ -z "$GITHUB_URL" ] && [ -n "$REPO_ORG" ]; then
    if [ "$REPO_ORG" = "tranfu-labs" ]; then
      ok "cwd org = tranfu-labs"
    else
      fail "cwd org=$REPO_ORG (期望 tranfu-labs)"
    fi
    if [ -n "$REPO_NAME" ]; then
      if echo "$REPO_NAME" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*-app$'; then
        ok "cwd 命名合规 (烤肉串-app, 全小写)"
      else
        fail "cwd 命名不合规: $REPO_NAME"
      fi
    fi
  fi

  # working tree clean (软模式只 ⚠)
  if (cd "$REPO_ROOT" && git diff --quiet && git diff --cached --quiet); then
    ok "cwd working tree clean"
  elif [ "$SOFT_MODE" = "1" ]; then
    manual "cwd working tree dirty (软检查: Step 2I 会用 mktemp clone 全新副本, 不动 cwd)"
  else
    fail "cwd working tree dirty (先 git commit / stash, 或传 GITHUB_URL 进入软检查模式)"
  fi
fi

# ---------- GitHub 凭据 ----------
echo
echo "▸ GitHub 凭据"

GH_USER=$(gh api user --jq .login 2>/dev/null || true)
if [ -n "$GH_USER" ]; then
  ok "gh auth status (user: $GH_USER)"
else
  fail "gh 未 auth (跑: gh auth login)"
fi

if [ -n "$GH_USER" ]; then
  SCOPES_LINE=$(gh auth status 2>&1 | grep -i "Token scopes:" | head -1 || true)
  if echo "$SCOPES_LINE" | grep -q "'repo'"; then
    ok "token scope 含 'repo' (gh secret set / variable set 需要)"
  else
    fail "token scope 缺 'repo' (跑: gh auth refresh -s repo)"
  fi
fi

# admin 权限探测: 优先用 GITHUB_URL 指定的 repo (软检查模式), 否则用 cwd 的 origin
ADMIN_ORG="${EXPECTED_ORG:-$REPO_ORG}"
ADMIN_NAME="${EXPECTED_NAME:-$REPO_NAME}"

if [ -n "$GH_USER" ] && [ -n "$ADMIN_ORG" ] && [ -n "$ADMIN_NAME" ]; then
  IS_ADMIN=$(gh api "repos/$ADMIN_ORG/$ADMIN_NAME" --jq '.permissions.admin' 2>/dev/null || true)
  case "$IS_ADMIN" in
    true)
      ok "repo admin permission ($ADMIN_ORG/$ADMIN_NAME)" ;;
    false)
      fail "用户 $GH_USER 对 $ADMIN_ORG/$ADMIN_NAME 无 admin permission (无法 set secret/variable)" ;;
    "")
      fail "拿不到 $ADMIN_ORG/$ADMIN_NAME 的 permission (repo 不存在或网络问题)" ;;
    *)
      fail "permission 探测异常返回: $IS_ADMIN" ;;
  esac
fi

# ---------- Coolify 凭据 ----------
echo
echo "▸ Coolify 凭据 ($BASE)"

TOKEN_OK=0
if [ -n "${COOLIFY_API_TOKEN:-}" ]; then
  ok "COOLIFY_API_TOKEN 已设置"

  # 活性 + 版本
  VER_BODY=$(curl -sS --max-time 10 \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "$BASE/api/v1/version" 2>/dev/null || true)
  CODE=$(curl -sS -o /dev/null --max-time 10 -w "%{http_code}" \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "$BASE/api/v1/version" 2>/dev/null || echo "000")
  case "$CODE" in
    200|201)
      VERSION=$(echo "$VER_BODY" | jq -r '.version // "unknown"' 2>/dev/null || echo "unknown")
      ok "token 拨 /api/v1/version → 200 (server $VERSION)"
      TOKEN_OK=1
      ;;
    401|403) fail "token 拨 /api/v1/version → $CODE (token 无效或权限不足)" ;;
    000)     fail "拨不通 $BASE (网络 / VPN / 服务挂了)" ;;
    *)       fail "/api/v1/version → $CODE" ;;
  esac

  # 写权限探测 (PATCH dummy uuid, 期望 404 = 鉴权 OK + 资源不存在)
  if [ "$TOKEN_OK" = "1" ]; then
    WRITE_CODE=$(curl -sS -o /dev/null --max-time 10 -w "%{http_code}" \
      -X PATCH \
      -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"name": "preflight-write-probe"}' \
      "$BASE/api/v1/services/00000000000000000000000000000000" 2>/dev/null || echo "000")
    case "$WRITE_CODE" in
      404)
        ok "token 有写权限 (PATCH dummy → 404 = write OK + 资源不存在)" ;;
      422)
        ok "token 有写权限 (PATCH dummy → 422 = 字段校验过, 鉴权过)" ;;
      401|403)
        fail "token 无写权限 (PATCH dummy → $WRITE_CODE, 只读 token)" ;;
      *)
        fail "写权限探测异常: PATCH dummy → $WRITE_CODE (期望 404/422)" ;;
    esac
  fi
else
  fail "COOLIFY_API_TOKEN 未设置 (在 shell 里 export COOLIFY_API_TOKEN=... 后重试)"
fi

# ---------- GHCR registry credential (manual ack) ----------
echo
echo "▸ Coolify · GHCR Registry Credential"
echo "  Coolify 拉 ghcr.io 私有镜像必须挂 credential。这是一次性配置, API 不暴露探测端点。"
echo "  Coolify UI → Sources / Container Registries → ghcr.io"
echo "    username = GitHub 用户名"
echo "    password = GitHub PAT (scope: read:packages)"
echo

if [ -t 0 ]; then
  printf "  已在 Coolify UI 挂了 ghcr.io credential? [y/N] "
  read -r ACK
  case "$ACK" in
    y|Y|yes|YES) ok "ghcr.io credential ack" ;;
    *)           manual "ghcr.io credential 未 ack (去 $BASE 配 → 跑这个流程)" ;;
  esac
else
  manual "ghcr.io credential 跳过 ack (非交互环境, 自动算手工)"
fi

# ---------- 汇总 ----------
echo
echo "===================================="
echo "Result: $PASS ✓ / $FAIL ✗ / $MANUAL ⚠"
if [ "$FAIL" -gt 0 ]; then
  exit 1
elif [ "$MANUAL" -gt 0 ]; then
  exit 2
else
  exit 0
fi
