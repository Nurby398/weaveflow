#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 门禁灵敏度自检（"不会失败的测试等于没有测试"）
#
# 做两件事，每件都要求对应门禁**必须变红**，做完自动还原：
#   ① 造布局回归（隐藏侧栏）      → 视觉基准必须红
#   ② 删掉字体声明（@font-face）  → 字体断言测试必须红
#
# 用法：bash scripts/verify-gate-sensitivity.sh
# 退出码：0 = 两道门禁都如期报警；1 = 有门禁"报警失败"（形同虚设）
# ---------------------------------------------------------------------------
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT=$(pwd)
echo "工程根：$ROOT"

BASE_CSS="src/styles/base.css"
FONT_CSS="src/styles/fonts.css"
FAILED=0

restore() {
  cp "$FONT_CSS.bak" "$FONT_CSS" 2>/dev/null || true
  rm -f "$FONT_CSS.bak"
  git checkout -- "$BASE_CSS" 2>/dev/null || true
}

cleanup() {
  restore
  echo "--- 现场已还原 ---"
}
trap cleanup EXIT

# ── ① 布局回归 → 视觉基准必须红 ────────────────────────────────────────────
echo "=== ① 造布局回归（隐藏侧栏），视觉基准应失败 ==="
printf '\n/* 灵敏度自检临时注入（脚本会自动还原） */\n.layout__nav { display: none !important; }\n' >> "$BASE_CSS"
npx playwright test e2e/visual.spec.js --grep "home · light" --reporter=list >/tmp/vis.out 2>&1
if grep -q 'passed' /tmp/vis.out && ! grep -q 'failed' /tmp/vis.out; then
  echo "  ✗ 视觉基准**没有**报警 —— 这道门禁是摆设"
  FAILED=1
else
  echo "  ✓ 视觉基准如期报警（布局回归被抓住）"
fi
git checkout -- "$BASE_CSS"

# ── ② 字体回归 → 字体断言必须红 ───────────────────────────────────────────
echo "=== ② 删掉 @font-face，字体断言应失败 ==="
cp "$FONT_CSS" "$FONT_CSS.bak"
printf '/** 临时：@font-face 全部移除（脚本会自动还原） */\n' > "$FONT_CSS"
npx playwright test e2e/font.spec.js --reporter=list >/tmp/font.out 2>&1
if grep -q 'passed' /tmp/font.out && ! grep -q 'failed' /tmp/font.out; then
  echo "  ✗ 字体断言**没有**报警 —— 这道门禁是摆设"
  FAILED=1
else
  echo "  ✓ 字体断言如期报警（字体丢失被抓住）"
fi
restore

# ── ③ 还原后复跑，两者都应通过 ────────────────────────────────────────────
echo "=== ③ 还原后复跑（都应通过）==="
npx playwright test e2e/visual.spec.js --grep "home · light" --reporter=list 2>&1 | tail -2
npx playwright test e2e/font.spec.js --reporter=list 2>&1 | tail -2

if [ "$FAILED" = "1" ]; then
  echo "结论：门禁灵敏度不合格"
  exit 1
fi
echo "结论：两道门禁都按预期报警 ✓"
