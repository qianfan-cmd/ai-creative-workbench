#!/usr/bin/env bash
# 在 ECS 上手动验证镜像拉取速度与鉴权（Deploy 超时排障用）
# 用法：
#   export GHCR_PAT='...'          # GHCR 包为 private 时
#   export IMAGE_TAG='cbf5dcc...'  # 与 Actions 部署 tag 一致
#   bash scripts/verify-ecs-image-pull.sh
set -euo pipefail

IMAGE_TAG="${IMAGE_TAG:-latest}"
GHCR_PREFIX="ghcr.io/qianfan-cmd/ai-creative-workbench"
ACR_PREFIX="${ACR_REGISTRY:-}${ACR_NAMESPACE:+/${ACR_NAMESPACE}}"

if [ -n "${ACR_REGISTRY:-}" ] && [ -n "${ACR_NAMESPACE:-}" ] && [ -n "${ACR_USERNAME:-}" ] && [ -n "${ACR_PASSWORD:-}" ]; then
  echo "=== login ACR: ${ACR_REGISTRY} ==="
  echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" -u "$ACR_USERNAME" --password-stdin
  PREFIX="${ACR_REGISTRY}/${ACR_NAMESPACE}"
elif [ -n "${GHCR_PAT:-}" ]; then
  echo "=== login GHCR ==="
  echo "$GHCR_PAT" | docker login ghcr.io -u "${GHCR_USER:-qianfan-cmd}" --password-stdin
  PREFIX="$GHCR_PREFIX"
else
  echo "WARN: 未设置 ACR 或 GHCR_PAT，public 包可能仍可 pull"
  PREFIX="${ACR_PREFIX:-$GHCR_PREFIX}"
fi

echo "=== registry probe ==="
curl -sS -o /dev/null -w "ghcr.io HTTP %{http_code} time=%{time_total}s\n" -I https://ghcr.io/v2/ || true
if [ -n "${ACR_REGISTRY:-}" ]; then
  curl -sS -o /dev/null -w "${ACR_REGISTRY} HTTP %{http_code} time=%{time_total}s\n" -I "https://${ACR_REGISTRY}/v2/" || true
fi

for svc in backend frontend ai; do
  img="${PREFIX}/${svc}:${IMAGE_TAG}"
  echo ""
  echo "=== pull ${img} ==="
  time docker pull "$img"
  docker image inspect "$img" --format '{{.Id}} size={{.Size}}'
done

echo ""
echo "=== done ==="
