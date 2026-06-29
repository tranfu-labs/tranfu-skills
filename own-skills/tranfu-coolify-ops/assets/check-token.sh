#!/usr/bin/env bash
# 检测 $COOLIFY_API_TOKEN 是否设置且能拨通 Coolify /api/v1/version。
#
# 用法:  ./check-token.sh [BASE_URL]
#        默认 BASE_URL = http://120.77.223.183:8000 (公司 Coolify 实例)
#
# 输出:  ✓                    成功
#        ✗ <人话原因>          失败
#
# 安全纪律: 永远不打印 $COOLIFY_API_TOKEN 的任何字节
#          (包括长度 / 前缀 / 任何派生字符串)。
#          失败原因只描述"哪一层挂了"，不暴露 token。
#
# 退出码: 0 成功 / 1 失败

set -u

BASE="${1:-http://120.77.223.183:8000}"

if [ -z "${COOLIFY_API_TOKEN:-}" ]; then
  echo "✗ COOLIFY_API_TOKEN 未设置 (在 shell 里 export COOLIFY_API_TOKEN=... 后重试)"
  exit 1
fi

CODE=$(curl -sS -o /dev/null -w "%{http_code}" \
  --max-time 10 \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$BASE/api/v1/version" 2>/dev/null) || CODE="000"

case "$CODE" in
  200|201)
    echo "✓"
    exit 0
    ;;
  401)
    echo "✗ 401 unauthorized: token 无效或已过期"
    exit 1
    ;;
  403)
    echo "✗ 403 forbidden: token 权限不足"
    exit 1
    ;;
  404)
    echo "✗ 404 not found: $BASE/api/v1/version 不存在 (BASE_URL 是否正确?)"
    exit 1
    ;;
  000)
    echo "✗ 连接失败: $BASE 不可达 (检查网络 / VPN / 服务是否在跑)"
    exit 1
    ;;
  *)
    echo "✗ 意外 HTTP 状态码: $CODE"
    exit 1
    ;;
esac
