# Grub Theme Visual Editor — Spike (V3 冻结约束)

> 定位：Spike 冻结约束，非最终 build 冻结。Spike 四门禁通过后出 V3.1 正式冻结。

## 技术栈
Tauri v2 + Vite 6 + React 18 + TS(strict) + Tailwind + shadcn/ui + Zustand+immer+zundo + Monaco + Canvas2D + JSZip + pnpm workspace + Vitest + Playwright。

## 实现契约（Spike期间强制）

### 1. CST节点定位与CSTPatch
- 每个CST节点分配稳定 `nodeId: string`（自增 `n1,n2...`）+ `range: {start:{line,col,offset}, end:{...}}`。
- `SemanticIndex` 项必带 `nodeId`：`boot_menu/labels[]/images[]/progressbars[]`，禁用 `label[0]` 模糊定位，用 `nodeId`。
- `CSTPatch = { nodeId, key, value, op:'set'|'insert'|'remove', source:'monaco'|'form'|'import' }`。
- UI只读`semantic`，写入只走 `updateProperty(path,value)` → `CSTPatch` → 应用CST → `executeEdits` 同步Monaco。

### 2. applyMonacoChange 生成patch：Spike选方案A
- **方案A（Spike采用）**：parse产新CST全量替换，但zundo只记文本快照/命令，不记整树。验证性能/撤销/光标可接受再定。
- 方案B（结构diff最小patch）延后，不为最小patch过早卡住。
- debounce 300ms + AbortController/版本号丢弃过期parse。

### 3. Undo边界
- 源码聚焦：Monaco undo优先，onChange同步store，zundo不重复记（或只记合并提交）。
- 表单聚焦：zundo记patch，Monaco用`executeEdits`同步+事务锁忽略回环。
- 焦点在Monaco则Ctrl+Z走Monaco，表单/画布则走zundo。
- 必测：10次“源码改→表单改→源码改”交替，无回环、无重复历史。

### 4. 渲染门禁细化
- 几何bbox纳入≤2px/1%：boot_menu.left/top/width/height、label.left/top、image.left/top/width/height、progress_bar.left/top/width/height。
- 文本bbox不纳入（fallback误差），只做可解释diff。
- 颜色exact：sRGB 0容差，`#RGB/#RRGGBB/r,g,b/SVG名`归一后比。
- fixture固定 `1024x768/1920x1080` 各一套，截图diff阈值写入Spike报告。

### 5. 导出路径策略（不强制固定目录）
- 保留导入原始相对路径；新建资源才落默认 `assets/、fonts/、icons/`。
- 缺失扫描：`desktop-image、file=、icon_dir、item_icon、font`。
- `themeName` 来源：用户输入默认=`目录名 || title-text slug`，处理非法字符/重名/空值。
- 缺资源导出前warning+清单，可阻止，不静默产坏包。

### 6. Tauri权限/Adapter修正
- fs scope：Spike验证dialog选择后动态授权，不只写`$APPDIR,$RESOURCE`。
- `hasNativeFont()/hasTruePreview(): Promise<boolean>`（异步检测命令存在，初始化缓存）。
- `shell:allow-execute scope` 必须匹配 `grub-mkfont` / `grub2-theme-preview` 实际路径；`Command.create(argv数组)`，禁shell拼接。
- UI禁直调 `@tauri-apps/*`，统一走 `PlatformAdapter`（见 `apps/editor/src/platform/adapter.ts`）。
- Web导出：`showSaveFilePicker→a[download]`；Tauri：`dialog+fs`（WebView内前者不可用）。

## Spike四门禁
1. 双构建：`pnpm build(web)` + `tauri build(win+linux, linux CI绿)`。
2. Round-trip：tela/vimix/argon三套，A字节恒等含CRLF/LF，B单字段diff仅目标行。
3. Canvas：四组件颜色exact+几何bbox≤2px/1%，文本diff可解释。
4. 交替编辑10次无回环、undo不双记。

## 目录
- `apps/editor/` Vite+React+Tauri壳
- `packages/grub-theme-core/` parser/CST/semantic/renderer
- `assets/samples/` 真实theme fixture
- `docs/SPIKE-REPORT.md` 门禁结果
