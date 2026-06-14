# 一家食光 · 完整测试方法与 Bug 挖掘计划

> 创建日期：2026-06-14
> 目的：系统性找出项目中尽可能多的 bug，涵盖安全、数据、逻辑、前端、AI 五大维度。
> 现有基础：smoke.mjs（65 条）、test-e2e.mjs（11 条）——均偏权限与主流程。**本计划找盲区。**

---

## 快速开始 · 测试优先级

```
第一优先：安全越权 + 数据完整性（必测，bug 后果最严重）
第二优先：业务逻辑边界（规格文档每条对照）
第三优先：前端浏览器实测（之前 script 都是 headless Node）
第四优先：AI 行为质量（agent-chat 人设/红线、GLM 错误处理）
第五优先：性能与并发（防崩/防慢）
```

---

## 一、安全与权限测试（补充已有 smoke，找 RLS/Edge 盲区）

### 1.1 RLS 盲区扫描

| 测试项 | 方法 | 预期 |
|--------|------|------|
| **Anon key 越权写** | 用 anon client（无 JWT）直接 `insert/update/delete` 每个表 | 全部被拒（RLS 要求 authenticated） |
| **伪造 JWT 跨家族访问** | userA 的 JWT 直接用 `family_id=F2的ID` 去读 F2 的 anchors/comments/members等 | 全部 0 行 / null |
| **批量修改他人数据** | userB update anchors set name='hacked' where family_id=F1（用自己身份） | RLS 过滤 0 rows |
| **未登录访问 Edge Functions** | curl agent-chat/ai-generate/kinship-rebuild **不带** Authorization header | 401 |
| **过期/伪造 JWT** | 拿过期 token 或自签 JWT 调 Edge Functions | 401 |
| **relate claim 暴力枚举 family_id** | 用 RPC 传其他家族的 code 或编造的 code | 被拒 |
| **family_members 改别人的 user_id** | 尝试 `update family_members set user_id=自己的uid where id=别人的节点` | RLS 拒 |
| **kinship_cache 前端直接写** | 前端用 anon client insert kinship_cache | RLS 拒（仅 service_role 可写）|
| **notifications 伪造发件人** | userA insert notification 到 userB（user_id=B） | RLS 拒（with check user_id = auth.uid()）|
| **capsules 改别人的胶囊** | userB update capsules set name='hack' where created_by=userA | RLS 拒 |

### 1.2 Edge Function 越权

| 测试项 | 方法 | 预期 |
|--------|------|------|
| agent-chat 传别人的 conversation_id | userB 发 `/functions/v1/agent-chat` 带 userA 的 conversation_id | 403 |
| ai-generate 传别人的 conversation_id | userB 调 story 用 userA 的对话 | 403 |
| ai-generate bio 跨家族读成员 | 非家族成员传 member_id + family_id 调 bio | 403 |
| kinship-rebuild 非成员调 | 注册全新号不加入家族直接调 rebuild | 403 |
| auth-forgot verify-answer 枚举用户名 | 批量试 username 看是否存在 | 统一报"用户名或密保答案错误"（不泄露） |
| auth-forgot 篡改 token | 自编 token 调 reset | token 校验失败/过期 |

### 1.3 密钥泄露检查

```bash
# 全仓扫描（包括 .html、.ts、.mjs、.json）
grep -ri "GLM_API_KEY\|sb_secret_\|service_role" --glob="*.{html,js,ts,jsx,css,mjs,json,md}" --exclude-dir=node_modules --exclude="*.log" --exclude="后端开发记录.md" --exclude="后端开发计划.md"
# 同样扫 git log
git log --all --oneline -- '*.html' '*.js' '*.ts' '*.mjs' | head -30
git log --all -p -- '*.html' '*.js' '*.ts' | grep -i "GLM_API_KEY\|sb_secret_\|RZPi"
```

---

## 二、数据完整性与约束测试

### 2.1 NULL/空白/极端值

| 测试项 | 方法 | 风险 |
|--------|------|------|
| username 为空串注册 | signUp 空 username | 应被拒或生成空邮箱 |
| family code 碰撞 | 快速创建 100 个家族看 code 是否依旧唯一 | 6 位码碰撞概率 |
| anchor 各字段全 null（除必填）| insert anchor 不给 era/city/text | 不应崩溃 |
| text 超长（100KB+）| insert anchor text='A'*100000 | Postgres 字段上限/前端渲染 |
| tags jsonb 非数组 | insert anchors tags='"not_array"' | 前端解析可能崩 |
| birth_date 非法日期 | addMember birthDate='1000-99-99' | 应被拒或兜底 |
| open_date 过去 10 年 | 封一个月胶囊 open_date='2010-01-01' | 应被检测到已过期 |
| target_members 空数组 | hook.create targetMemberIds=[] | RPC 不应崩溃 |
| to_members 空数组 | 胶囊不给任何人 | 应合法"只存不送" |

### 2.2 外键与级联

| 测试项 | 方法 | 预期 |
|--------|------|------|
| 删 family → 级联检查 | admin 删一个 family，查 members/relations/anchors/comments/hooks/capsules 是否残留 | 全部级联删除 |
| 删 auth.users → profiles 级联 | admin 删用户，查 profiles 行 | 自动级联删 |
| 孤儿数据 | 用 admin 查 family_members where family_id 不在 families | 结果 0 |
| 孤儿 relations | 查 family_relations where from_member/to_member 不在 family_members | 结果 0 |

### 2.3 并发与竞态

| 测试项 | 方法 | 预期 |
|--------|------|------|
| 两人同时抢占同一占位节点 claim | 两个号同时对同一 placeholder 调 claim RPC | 至少一个报错，不会两个都成功 |
| 两人同时转让创建者 | 两个号同时 transfer_creator 同一家族 | 一人成功，另一人拒绝 |
| 最后一刻删家族 | A 正在填申请，B 删了家族 | A 的 request_join 报错 |

---

## 三、业务逻辑对照测试（参照《需要补充逻辑_整理版.md》）

### 3.1 点亮闭环（§1.1-1.6）

| 编号 | 测试场景 | 操作步骤 | 预期 |
|------|---------|---------|------|
| B-01 | A 提出 A 讲 = 点亮 ✅ | A create gray → A create lit 同 dish | lit anchor 创建成功 |
| B-02 | A 提出 B 讲 = 点亮 ✅ | A 抛钩子(dish=X) → B create lit(dish=X) | lit 创建成功 |
| B-03 | 钩子关联的人还没讲 → open 态 | A 抛钩子 target=B → 查 hook.status | open |
| B-04 | 晚到者自动补述（§1.6）| A lit → B 也想讲同 dish → B 的文本变 comment | comment 自动创建 |
| B-05 | 钩子指定接收者通知"被点名"| A 抛钩子 target=B → 查 B 的通知 | 类型=poke，B 收到 |
| B-06 | 晚到者悬浮提示 + 3s 跳转 | 前端实测（见 §五）| 悬浮出现 → 3s → 跳 P11 |
| B-07 | 全选联动 | 前端实测（见 §五）| 全选↔手动选中联动 |

### 3.2 家族权限（§3.7）

| 编号 | 测试场景 | 预期 |
|------|---------|------|
| B-08 | 成员选转让 → 被拒 | RPC 校验 creator_id |
| B-09 | 创建者退出前未转让 → 被拒 | RPC 提示先转让 |
| B-10 | 转让后旧创建者 role → member | families.creator_id 变更 + members.role 变更 |
| B-11 | 转让后旧创建者可退出 | leave_family 成功 |
| B-12 | 成员编辑家族信息 → 被拒 | RLS families_update 拒 |
| B-13 | 成员重置代码 → 被拒 | RPC 校验 |
| B-14 | 成员 approve/reject → 被拒 | RPC 校验 |
| B-15 | 成员看自己资料 vs 他人资料编辑入口 | 前端组件条件渲染 |

### 3.3 时间胶囊（§5.1-5.4）

| 编号 | 测试场景 | 预期 |
|------|---------|------|
| B-16 | 设为胶囊后从味道桌消失 | capsule 关联的 anchor 不再出现在 lit 列表（或标明"已封存"）|
| B-17 | 到期前一天提醒赠送方 | pg_cron 自动调 capsule_due_reminders → 通知 created_by |
| B-18 | 到期当天提醒被赠方 | pg_cron 自动调 open_due_capsules → 通知 to_members |
| B-19 | 收到胶囊后 → 自动变我味道桌 lit | 被赠方收到启封后，anchor 出现在其味道桌 |
| B-20 | 胶囊编辑页"送给谁"全选联动 | 同 B-07 |
| B-21 | 赠送方可取消/调整启封 | 启封前（sealed 态）可改 open_date 或删除 |
| B-22 | 提前手动开启 | 创建者 open due capsules 即时执行 |

### 3.4 AI 相关（§2.1-2.5）

| 编号 | 测试场景 | 预期 |
|------|---------|------|
| B-23 | 标签生成 4-5 个 | generate-tags 返回数组长度 4-5 |
| B-24 | 标签随正文更新重新生成 | 编辑记忆改正文 → 保存 → 新标签 ≠ 旧标签 |
| B-25 | 缺失信息兜底 年代→1900 | story 输出 city 为空时 story.scene.location.city 为 "未知" |
| B-26 | 缺失信息兜底 其余→"未知" | 无菜名→"未知" |
| B-27 | 无图用默认图 | 前端检查：anchor 无 img_url 时显示默认图 |
| B-28 | 草稿自动保存（§2.3）| 未完结点亮/删除 → 回草稿箱可看到 |
| B-29 | agent-chat 三条初始状态 | 空白/带钩子提示/带记忆+提示 |

### 3.5 关系与称谓（§3.3-3.4）

| 编号 | 测试场景 | 预期 |
|------|---------|------|
| B-30 | 关系编辑后家谱树自动更新 | 改 parent_of 边 → 树重算 → 称谓变 |
| B-31 | 称谓格式"关系·名字" | P20/P21 显示"父亲·张三"格式 |
| B-32 | 确定关系仅 6 选 1 | 关系选择器只显示：父/母/子/女/夫/妻 |
| B-33 | 长辈→自己→晚辈 代际正确 | 加父亲→出现于自己上方；加儿子→出现于下方 |
| B-34 | 堂/表判定 | 加堂兄/表妹验证 kinship 推导 branch 字段 |
| B-35 | 伯/叔判定 | 加两个 uncle，根据与父亲年龄比对分伯/叔 |

### 3.6 地图与时间轴（§6.1-6.3）

| 编号 | 测试场景 | 预期 |
|------|---------|------|
| B-36 | 地图封面=该城首条记忆吃食图 | P60 城市卡片用第一条有图 anchor 的 img_url |
| B-37 | 地址范围仅中国 | 前端省份/城市选择器限制中国 |
| B-38 | 时间轴按 era 排序 | P60 时间轴按年份 1998→2005→2012 递增 |

---

## 四、AI / Edge Function 专项测试

### 4.1 agent-chat 行为质量

| 编号 | 测试项 | 方法 |
|------|--------|------|
| A-01 | **红线 7 条逐一回归** | 取之前 6 轮对话实录，逐条检查 7 条红线 |
| A-02 | 时空挖掘自然度 | 发 5 轮新对话，检查是否出现"请问是哪一年""请提供城市" |
| A-03 | 不主动问生死 | 发含"外婆"的对话，检查是否出现"还在吗" |
| A-04 | CTA 触发时机 | 对话到 5-6 轮且 state locked=true 时，`cta_ready` 是否 true |
| A-05 | 籍贯锚点问城市 | 成员 hometown 含"扬州"时，AI 是否温和带出 |
| A-06 | 一次只问一个核心问题 | 除"时间+地点可同句"外，不出现两不相关问题 |
| A-07 | 不自称 AI | 全文搜索 "AI""助手""机器人" |
| A-08 | 推理模型延迟 | 记录 10 轮 agent-chat 的响应时间（glm-5.1 reasoning 可能 30s+）|
| A-09 | 超时处理 | 设 1s 超时 → agent-chat 返回 504，前端不崩 |
| A-10 | 空消息/纯空格消息 | 发 "   " → 应有友好提示或拒 |

### 4.2 ai-generate 质量

| 编号 | 测试项 | 方法 |
|------|--------|------|
| A-11 | story 输出结构完整性 | 检查 §10.2 的 food/people/scene/emotion/related_foods/story_suggestions/gray_anchor_suggestions 是否齐全 |
| A-12 | recipe 食材+步骤合理性 | 喂一段红烧肉描述 → 检查输出食材>0、步骤>0 |
| A-13 | tags 全中文 | 检查所有标签是否中文，不应出现英文 |
| A-14 | bio 字数 120-200 | 逐字计数 |
| A-15 | 不存在的 action → 400 | ai-generate action='nonexistent' |
| A-16 | 缺少必填字段 → 400 | 调 story 不给 conversation_id |
| A-17 | 超长文本处理 | 喂 5000 字记忆 → 不应崩溃 |

### 4.3 GLM 后端容错

| 编号 | 测试项 | 方法 |
|------|--------|------|
| A-18 | GLM 返回空 content（reasoning 吃光）| 模拟或观察 → 应有 reasoning 兜底提取 |
| A-19 | GLM 返回非 JSON 的 story | 应 parse 失败 → 返回错误，不落脏数据 |
| A-20 | GLM 网络超时 | 设极短超时 → 返回 504 |
| A-21 | GLM 返回 500/503 | 模拟 → Edge 应返回 502 + 原始错误信息 |

---

## 五、前端浏览器实测（之前脚本全是 headless，前端 bug 是盲区）

### 5.1 登录/认证流

| 编号 | 操作 | 预期 |
|------|------|------|
| F-01 | 正常登录 test001/test001pw | 进 P2，家族列表显示 |
| F-02 | 错误密码登录 | "用户名或密码错误" |
| F-03 | 不存在的用户名 | 同上（不泄露存在性）|
| F-04 | 注册 → 自动登录 → 进 P2 | 一字不漏 |
| F-05 | 注册用户名已存在 | 报错提示 |
| F-06 | 忘记密码 → 验答案 → 改密 → 新密码登录 | 三步骤全走通 |
| F-07 | 改密后旧密码失效 | 旧密码登录失败 |
| F-08 | 退出 → 回 P1 | signOut 成功 |
| F-09 | 改密保 | P51 改密保答案 → 新答案找回成功 |

### 5.2 家族与家谱（P2/P3/P20/P52）

| 编号 | 操作 | 预期 |
|------|------|------|
| F-10 | 创建家族 → code 显示 → 复制 | 弹 toast "已复制" |
| F-11 | 凭码加入（P2→P3）| P3 显示家族名 + 成员列表 |
| F-12 | Relate "我是 X 的 Y" → 进家谱 | 节点出现在正确代际 |
| F-13 | Claim "我就是谱上的 XX" | 占位节点变已认领 |
| F-14 | P20 家谱树渲染 → 节点位置/连线 | 父在上、子在下、配偶同代相邻 |
| F-15 | P20 点自己 → P21 真实数据 | 看到姓名/称谓/生卒/籍贯/味道 |
| F-16 | P21 编辑 → P_EditMember → 改资料 → 保存 | 回 P21 数据变 |
| F-17 | P_EditMember 改关系 → 重定位 | 家谱树更新、称谓更新 |
| F-18 | P20 点已故节点 | 样式不同、有离世年份 |
| F-19 | P52 家族管理 → 创建者看编辑铅笔/转让/重置 | 按钮出现 |
| F-20 | P52 家族管理 → 成员只看到成员标签 | 无铅笔/转让/重置 |
| F-21 | P52 待审核 → approve/reject | 成员列表刷新、通知送达 |
| F-22 | P52 转让创建者 | role 对调、旧 creator 可退出 |
| F-23 | P52 重置家族代码 | 新 code ≠ 旧 code |
| F-24 | 添加家人 → 6 关系 → 性别自动 | 选"父亲"→自动男、选"妻子"→自动女 |

### 5.3 味道桌（P10/P11/P_EditMemory）

| 编号 | 操作 | 预期 |
|------|------|------|
| F-25 | P10 lit/gray 切换 | tab 切换数据刷新 |
| F-26 | P10 搜索吃食 | 输入关键词→过滤结果 |
| F-27 | P10 家族切换（左上角）| 数据切换 |
| F-28 | P10 抛钩子 sheet → 选成员 → 抛 | 成功、通知到达 |
| F-29 | P11 点 lit 卡片 → 详情 | 显示名称/年代/城市/正文/标签/图 |
| F-30 | P11 右上角"三个点"→自己 vs 别人 | 自己→编辑记忆；别人→查看记忆 |
| F-31 | P11 补述 comments → 增/删/改 | 本人可改删、他人只读 |
| F-32 | P11 AI 还原料理 → 菜谱弹出 | 食材列表+步骤显示 |
| F-33 | P_EditMemory 编辑正文 → 保存 → 标签重生成 | 标签更新 |
| F-34 | P_EditMemory 图片 4:3 裁剪上传 | 上传→显示→公开 URL 可访问 |

### 5.4 AI 对话（P30/P31）

| 编号 | 操作 | 预期 |
|------|------|------|
| F-35 | P30 "讲一种味道" → 新建对话 | 创建 conversation → 发首条消息 |
| F-36 | P30 发消息 → 机器人回复 | "正在想…"气泡 → AI 真实回复出现 |
| F-37 | P30 CTA "整理成故事"出现 | 足够轮次后按钮显示 |
| F-38 | P30 左侧图片上传 | 缩略图显示 → 可移除 |
| F-39 | P30 退出 → 标草稿 → 草稿箱看得到 | 草稿列表出现 |
| F-40 | P_Drafts 续聊 | 恢复历史+state+CTA |
| F-41 | P_Drafts 删除 | 移出草稿列表 |
| F-42 | P31 故事展示 | food/people/scene/emotion 各字段映射正确 |
| F-43 | P31 「点亮」→ 建 lit anchor | 味道桌出现、故事关联 |
| F-44 | P31 gray_anchor_suggestions 落库 | 灰锚点创建 |
| F-45 | P31 「封存胶囊」→ 选人/日期 → 封 | capsule create、从味道桌消失（如已关联 anchor）|
| F-46 | P31 「送给谁」全选联动 | 同 B-07 |
| F-47 | P31 「重写一版」 | 重新 generate story |
| F-48 | P31 标签真调 generateTags | 4-5 个中文标签 |

### 5.5 动态/通知/我的（P40/P50/P_Notifications）

| 编号 | 操作 | 预期 |
|------|------|------|
| F-49 | P40 动态 Feed → 全部/与我相关/待我回应 | tab 过滤正确 |
| F-50 | P40 动态详情"去看看"→ 跳 P11 | 按 anchorId 正确跳转 |
| F-51 | P40 抛钩子 sheet → 选成员 → 全选联动 | 同 B-07 |
| F-52 | P40 「戳一下」→ 对方收到通知 | mention=on 时通知+1 |
| F-53 | P50 我的 → 头像首字母/昵称/memCount/draftCount | 数字与真实数据一致 |
| F-54 | P50 消息铃铛 → 未读红点 | unread>0 显红点 |
| F-55 | P50 消息 sheet → 列表 → 单条已读/全部已读 | 红点消 |
| F-56 | P_Notifications → 列表 → 点击跳转 | join/comment/light/capsule/poke 各跳对页面 |
| F-57 | P51 通知偏好开关 → 即时保存 | 关 mention → 别人戳不投递 |

### 5.6 地图/纪念册/胶囊（P60/P61/P62）

| 编号 | 操作 | 预期 |
|------|------|------|
| F-58 | P60 地图 → 城市网格 | 城市+封面+计数 |
| F-59 | P60 点城市 → 该城 anchors | 列表正确的 anchors |
| F-60 | P60 时间轴 → era 排序 | 时间线正序 |
| F-61 | P60 空态 | 无锚点时友好提示 |
| F-62 | P61 生成纪念册 → AI 引言 | 引言 200-300 字→显示 |
| F-63 | P61 "导出 PDF"→ 不跳转 | 按 §八 不做 |
| F-64 | P61 "导出图册"→ 不跳转 | 同上 |
| F-65 | P61 "系统分享"→ 不跳转 | 同上 |
| F-66 | P62 时间胶囊列表 | sealed/open 分态显示 |
| F-67 | P62 编辑胶囊 "送给谁" 全选联动 | 同 B-07 |

### 5.7 通用前端健壮性

| 编号 | 操作 | 预期 |
|------|------|------|
| F-68 | 页面刷新后数据恢复 | 刷新 P20 → 家谱还在（从 DB 重载）|
| F-69 | 网络断开时操作 | 报友好错误，不白屏 |
| F-70 | 快速连点按钮 | 不会重复创建（disable 期间不可点）|
| F-71 | 浏览器后退/前进 | 不丢状态/不白屏 |
| F-72 | 移动端布局（Chrome DevTools 手机模式）| 不崩不溢、按钮可点 |
| F-73 | P0 右上角色标（Supabase 连通指示器）| 绿色✅ |
| F-74 | Babel 编译无报错 | 控制台无 SyntaxError / 红字 |
| F-75 | 整个 `window.api` 各命名空间可访问 | auth/family/anchor/hook/conversation/ai/notif/feed/me/capsule/map/memorial/upload 均 !undefined |

---

## 六、性能与并发测试

### 6.1 数据库查询性能

```sql
-- 用 supabase SQL editor 跑，检查执行时间
EXPLAIN ANALYZE SELECT * FROM anchors WHERE family_id = '<真实famId>' AND status = 'lit' ORDER BY created_at DESC;
EXPLAIN ANALYZE SELECT * FROM kinship_cache WHERE family_id = '<真实famId>';
EXPLAIN ANALYZE SELECT * FROM family_members WHERE family_id = '<真实famId>';
```

### 6.2 Edge Function 响应时间

| 测试项 | 方法 | 阈值 |
|--------|------|------|
| glm-proxy 简单调用 | curl + time | < 5s |
| agent-chat 一轮（含 reasoning）| 同上 | < 40s |
| ai-generate story | 同上 | < 40s |
| ai-generate recipe | 同上 | < 30s |
| ai-generate tags | 同上 | < 15s |
| ai-generate memorial | 同上 | < 60s |
| kinship-rebuild | 14 人全家谱 | < 5s |

### 6.3 并发

| 测试项 | 方法 |
|--------|------|
| 10 个并发 agent-chat 请求 | 同时发 10 个 POST，看是否有 500/超时 |
| 同时 5 人 claim 同一 placeholder | 是否出现重复认领 |

---

## 七、自动化测试脚本扩充计划

基于以上盲区，对 `scripts/smoke.mjs` 进行如下扩充：

### 7.1 新增：RLS 盲区批量验证（+5 条）

```javascript
// ── RLS 盲区 ──
// 1. anon client 越权（无 JWT），测试每张核心表 insert
// 2. 跨家族访问（userB 带 F1 family_id 读写各表）
// 3. 未认证调 Edge Functions
```

### 7.2 新增：数据完整性检查（+6 条）

```javascript
// ── 数据完整性 ──
// 4. 空 target_members 的 hook 不崩溃
// 5. 空 to_members 的 capsule 允许创建
// 6. 删家族后级联验证
// 7. 孤儿数据检查（member 无 family、relation 无 member）
// 8. tags jsonb 非数组不崩
// 9. birth_date 非法日期 RPC 拒
```

### 7.3 新增：业务逻辑验证（+8 条）

```javascript
// ── 业务逻辑 ──
// 10. 胶囊前一天提醒赠送方（§5.4）— 已测
// 11. 晚到者自动补述 带自动检测 — 需模拟 lit 已存在 + B 再讲同 dish
// 12. generate-tags 返回 4-5 个 — 已测
// 13. generate-bio 字数 120-200 — 补断言
// 14. generate-recipe 非空食材/步骤 — 补断言
// 15. 转让后旧创建者退出 + 角色变更 — 已测
// 16. 码碰撞检测 — 造 100 家族验证 code 唯一
// 17. capsule 幂等（reminder_sent 不重复提醒）— 已测
```

### 7.4 新增：Edge Function 错误处理（+5 条）

```javascript
// 18. agent-chat 空消息
// 19. ai-generate 无效 action → 400
// 20. ai-generate 缺 conversation_id → 400
// 21. agent-chat 跨 user conversation → 403
// 22. GLM 超时 → 504
```

### 7.5 新增：前端健壮性脚本（不可 headless，需 UI 自动化）

创建一个 `scripts/ui-check.mjs`（用 Puppeteer/Playwright）：
- 打开浏览器 → 登录 → 遍历各页面 → 截图对比
- 或者至少列出**手工清单**逐项打勾

---

## 八、执行路线图（建议顺序）

```
Step 1（30 分钟）：跑一遍已有的 smoke.mjs + test-e2e.mjs，确认基线 65/11 PASS
Step 2（45 分钟）：按本计划「一、安全权限」逐条手工+脚本测，重点关注 RLS 盲区
Step 3（30 分钟）：按本计划「二、数据完整性」测极端输入/孤儿数据/级联
Step 4（60 分钟）：浏览器打开一家食光.html，按「五、前端实测」清单逐条点
Step 5（30 分钟）：手工 curl + 对照规格检查 AI 行为（agent-chat 红线）
Step 6（30 分钟）：跑性能 SQL + 并发 curl
Step 7（20 分钟）：安全 grep 最终确认
```

---

## 九、Bug 严重级别定义

| 级别 | 定义 | 例子 |
|------|------|------|
| 🔴 P0 致命 | 安全漏洞、数据丢失、全站不可用 | RLS 被绕过、密钥泄露、登录挂掉 |
| 🟠 P1 严重 | 核心流程断裂、用户数据错误 | 家谱树不显示、点亮失败、称谓全错 |
| 🟡 P2 中等 | 功能缺陷、体验问题 | 标签偶尔为空、图片不显示、搜索慢 |
| 🟢 P3 轻微 | 边角问题、UI 瑕疵 | 间距不对、文字截断、空态文案不友好 |

---

*计划持续更新。每发现一个 bug 在此文件末尾追记：编号、严重级别、复现步骤、根因、修复方案。*
