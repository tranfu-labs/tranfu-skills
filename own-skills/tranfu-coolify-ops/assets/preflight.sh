#!/usr/bin/env bash
# preflight.sh — tranfu-coolify-ops 部署前全部前置检测
#
# 用法:  ./preflight.sh [BASE_URL]
#        默认 BASE_URL = http://120.77.223.183:8000
#
# 工作目录: cd 到你要部署的 git 仓库根目录再跑
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

BASE="${1:-http://120.77.223.183:8000}"

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

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -n "$REPO_ROOT" ]; then
  ok "仓库根: $REPO_ROOT"
else
  fail "当前 cwd 不在 git 仓库 (cd 到仓库根再跑)"
fi

REPO_ORG=""; REPO_NAME=""
ORIGIN=$(git remote get-url origin 2>/dev/null || true)
if [ -n "$ORIGIN" ]; then
  # 用 bash 字符串操作解析 (BSD sed 不支持 +? 非贪婪量词, portable 起见手撕)
  # 去掉可能的 .git 后缀和尾部 /
  ORIGIN_CLEAN="${ORIGIN%.git}"
  ORIGIN_CLEAN="${ORIGIN_CLEAN%/}"
  # 找 github.com 后的部分 (ssh: git@github.com:org/repo, https: https://github.com/org/repo)
  case "$ORIGIN_CLEAN" in
    *github.com:*) REPO_PATH="${ORIGIN_CLEAN#*github.com:}" ;;
    *github.com/*) REPO_PATH="${ORIGIN_CLEAN#*github.com/}" ;;
    *)             REPO_PATH="" ;;
  esac

  if [ -n "$REPO_PATH" ]; then
    REPO_ORG="${REPO_PATH%%/*}"
    REPO_NAME="${REPO_PATH##*/}"
    if [ -n "$REPO_ORG" ] && [ -n "$REPO_NAME" ] && [ "$REPO_ORG" != "$REPO_NAME" ]; then
      ok "origin: $REPO_ORG/$REPO_NAME"
    else
      fail "origin URL 解析失败: $ORIGIN (期望 github.com:<org>/<repo> 或 https://github.com/<org>/<repo>)"
      REPO_ORG=""; REPO_NAME=""
    fi
  else
    fail "origin 不是 GitHub URL: $ORIGIN (本 skill 只支持 GitHub 仓库)"
  fi
else
  fail "无 origin remote (git remote add origin <url>)"
fi

if [ -n "$REPO_ORG" ]; then
  if [ "$REPO_ORG" = "tranfu-labs" ]; then
    ok "org = tranfu-labs"
  else
    fail "org=$REPO_ORG (期望 tranfu-labs)"
  fi
fi

if [ -n "$REPO_NAME" ]; then
  if echo "$REPO_NAME" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*-app$'; then
    ok "命名合规 (烤肉串-app, 全小写)"
  else
    fail "命名不合规: $REPO_NAME (期望 烤肉串-app 形式)"
  fi
fi

if [ -n "$REPO_ROOT" ]; then
  if (cd "$REPO_ROOT" && git diff --quiet && git diff --cached --quiet); then
    ok "working tree clean"
  else
    fail "working tree dirty (先 git commit / stash)"
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

if [ -n "$GH_USER" ] && [ -n "$REPO_ORG" ] && [ -n "$REPO_NAME" ]; then
  IS_ADMIN=$(gh api "repos/$REPO_ORG/$REPO_NAME" --jq '.permissions.admin' 2>/dev/null || true)
  case "$IS_ADMIN" in
    true)
      ok "repo admin permission" ;;
    false)
      fail "用户 $GH_USER 对 $REPO_ORG/$REPO_NAME 无 admin permission (无法 set secret/variable)" ;;
    "")
      fail "拿不到 $REPO_ORG/$REPO_NAME 的 permission (repo 不存在或网络问题)" ;;
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
