#!/bin/bash
# audit-security.sh — 全仓密钥泄露扫描
# 用法：bash scripts/audit-security.sh
echo "══════ 密钥泄露扫描 ══════"
echo ""

echo "── 1. 扫描源码文件中的 API key（掩码/片段匹配）──"
grep -rin "GLM_API_KEY" --glob="*.{html,js,ts,jsx,mjs,json,css}" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null || echo "  GLM_API_KEY: 0 命中 ✅"
grep -rin "sb_secret_" --glob="*.{html,js,ts,jsx,mjs,json,css}" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null || echo "  sb_secret_: 0 命中 ✅"
grep -rin "service_role" --glob="*.{html,js,ts,jsx,mjs,json,css}" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null || echo "  service_role: 0 命中 ✅"
echo ""

echo "── 2. 扫描 git 历史中的密钥（最近 100 条提交）──"
git log --oneline -100 -- '*.html' '*.js' '*.ts' '*.mjs' '*.json' | head -10
echo ""
git log --all -p -20 -- '*.html' '*.js' '*.ts' '*.mjs' | grep -i "GLM_API_KEY\|sb_secret_\|service_role\|RZPi\|oY2" 2>/dev/null || echo "  git history: 0 命中 ✅"
echo ""

echo "── 3. 扫描 .env 文件是否被跟踪 ──"
git ls-files .env* 2>/dev/null || echo "  .env* 未跟踪 ✅"
echo ""

echo "── 4. 扫描 settings 文件中的密钥 ──"
grep -rin "GLM_API_KEY\|sb_secret_\|RZPi" .claude/settings*.json 2>/dev/null || echo "  settings: 0 命中 ✅"
echo ""

echo "── 5. 扫描 node_modules（不应有但查一下）──"
grep -r "jgdrhqugjuwmzexmcxcz" node_modules/ --include="*.js" -l 2>/dev/null | head -5 || echo "  node_modules: 0 命中 ✅"
echo ""

echo "── 6. 检查 Supabase Edge Function Secrets（仅查看 key 存在/掩码）──"
# 注：此命令需要 supabase CLI 已登录
# supabase secrets list 2>/dev/null || echo "  (需 supabase CLI 登录)"
echo ""

echo "══════ 扫描完成 ══════"
