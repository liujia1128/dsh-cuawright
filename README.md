# dsh-cuawright

把 [CUAWright](https://github.com/microsoft/CUAWright)（原 Webwright）的浏览器与桌面自动化能力，做成 **DeepSeek Harness（DSH）插件**。

装上之后，DSH 的技能目录里会多出两个技能：`cuawright-web` 和 `cuawright-desktop`。你直接用自然语言描述网页任务，智能体就会用宿主自带的 shell、文件、读图工具，按 CUAWright 的“代码即动作”流程把任务跑完，并把 `plan.md`、`final_runs/run_<id>/`、截图和操作日志留在工作区。

- 浏览器流程由**宿主智能体原生驱动**，不需要额外的模型 API Key。
- 桌面流程驱动 `cuawright desktop` 命令行（OSWorld-V2 Ubuntu 虚拟机），需要它自己的 Responses API Key。

## 来源与关系

本仓库 fork 自 [microsoft/CUAWright](https://github.com/microsoft/CUAWright)，但**只发布 DSH 插件层**，不重复上游的 Python 运行时（`src/cuawright/`、OSWorld 复现脚本、基准数据等仍在上游）。

- 技能文本派生自上游 `skills/cuawright-web/`，并按 DSH 的工具名与脚本启动方式改写。
- `index.js`、`package.json`、`locale/`、`icon.svg` 为本仓库新增。
- 上游同样提供 Claude Code（`.claude-plugin/`）与 OpenAI Codex（`.codex-plugin/`）插件清单；本仓库是同一能力的第三个宿主适配。

## 目录结构

```text
dsh-cuawright/
├── package.json          # bundle 清单：dsh.bundle.patch + locale/icon 导出
├── cordis.patch.yml      # 插入一行 Host 插件：id=cuawright, name=dsh-cuawright
├── index.js              # Host 插件：把 skills/*/SKILL.md 注册进 ctx.skills
├── skills/
│   ├── cuawright-web/
│   │   ├── SKILL.md
│   │   └── reference/    # playwright_patterns / workflow / cli_tool_mode
│   └── cuawright-desktop/
│       └── SKILL.md
├── locale/
│   ├── en.json           # 插件管理器的标题与描述（英文）
│   └── zh.json           # 同上（中文）
├── icon.svg              # 36×36 插件图标
├── LICENSE               # MIT（含上游版权声明）
└── NOTICE                # 上游归属说明
```

## 它装了什么

| 技能 | 触发场景 | 关键点 |
|---|---|---|
| `cuawright-web` | 网页搜索、筛选、填表、多步流程、数据抓取、比价、库存/票务查询 | 一条 shell 命令一步；`plan.md` 列关键点；`final_runs/run_<id>/final_script.py` 可复跑；逐张读 PNG 自检 |
| `cuawright-desktop` | VM 内的桌面应用操作（文件编辑、办公软件、CAD、系统设置）、OSWorld-V2 官方任务复现 | 驱动 `cuawright desktop run` / `reproduce osworld`；产物 `manifest.json`、`trace.jsonl`、`result.json` |

## 安装

### 方式一：插件管理器界面

1. **Plugins** → **Add plugin** → 选择本仓库目录（克隆后的绝对路径）。
2. 在 **Plugins** 列表里确认出现 `cuawright` 一行。

### 方式二：智能体工具

```text
plugin_manager  action: install_bundle  target: <本仓库绝对路径>
```

返回 `application: applied` 即生效；新装 bundle 通过 HMR 激活，不需要重启 Harness。

### 方式三：本地克隆后手动指路

```pwsh
git clone https://github.com/liujia1128/dsh-cuawright.git
# 然后在 Plugins → Add plugin 里选 D:\workspace\dsh-cuawright
```

安装后 DSH 会在当前 profile 里建立到该目录的链接，所以**改文件立即反映到下一次激活**（但技能正文需要 reload，见“维护”）。

## 依赖

浏览器技能（`cuawright-web`）只需要 Playwright：

```pwsh
python -m pip install playwright
python -m playwright install chromium
```

- 默认引擎是 **Chromium**。
- 少数站点（Akamai 防护，如 cars.com）会用 `ERR_HTTP2_PROTOCOL_ERROR` 拒绝 Chromium，此时再装 Firefox 并把脚本里的一行改成 `playwright.firefox.launch(headless=True)`：

  ```pwsh
  python -m playwright install firefox
  ```

桌面技能（`cuawright-desktop`）额外需要：Python 3.12+、Docker、`pip install -e ".[desktop]"`（在上游检出里执行）、一个 Responses 兼容 API Key，以及两个 gated 数据集的授权（详见上游 `REPRODUCE.md`）。

`index.js` 会把技能里的 `{{CUAWRIGHT_ROOT}}` 替换成上游检出路径，解析顺序：

1. 环境变量 `CUAWRIGHT_ROOT`；
2. 插件目录的父目录（即插件放在上游检出的 `dsh-plugin/` 时的位置）；
3. 插件目录旁的 `CUAWright/` 目录（本仓库与上游检出并排克隆时）。

都找不到时，技能正文会提示智能体自行定位含 `pyproject.toml` 的目录。**只跑浏览器任务时完全不需要上游检出。**

## 使用

### 浏览器任务

直接说任务即可，技能按描述自动激活：

```text
帮我上京东搜「机械键盘」，价格 300-500，只看自营，按销量排序，
把前三名的名称、价格、销量截图存下来，最后告诉我最便宜的那个。
```

也可以点名技能，或显式指定输出目录：

```text
用 cuawright-web 技能，打开 example.com，报告页面标题和主链接，输出到 outputs/smoke/。
```

### 可复用 CLI（参数化模式）

在任务后追加一句即可，`final_script.py` 会变成一个带 `argparse` 的可复用工具：

```text
…同上，但做成可复用的 CLI：要能 --keyword / --min-price / --max-price 重跑，
默认值等于这次的任务参数。
```

### 桌面任务

```text
用 cuawright-desktop 帮我在 VM 里创建 /home/user/notes.txt，
写一个三行的会议准备清单，然后重新打开校验内容。
```

### 产物与验收

```text
outputs/<task_id>/
├── plan.md                       # 关键点清单（CP1..CPn）
├── screenshots/explore_*.png     # 探索期截图
└── final_runs/run_1/
    ├── final_script.py           # 最终脚本（可复跑）
    ├── final_script_log.txt      # step N action: ...，末尾 FINAL_RESPONSE
    └── screenshots/final_execution_*.png
```

验收看两处：`final_script_log.txt` 里每个关键点是否有对应日志；`screenshots/` 里对应截图是否真的显示了该状态（技能要求逐张读图确认，不许凭猜）。

## 工作原理

`index.js` 导出一个 Host 插件：

```js
export const inject = ['skills']
export function apply(ctx) { /* 遍历 skills/*/SKILL.md 并注册 */ }
```

- 遍历 `skills/*/SKILL.md`，解析 `---` 之间的 YAML frontmatter（`name`、`description`、`whenToUse`）。
- 用 `ctx.skills.register()` 注册，`source: 'custom'`，`resourceBase` 指向该技能目录，因此技能正文里写的 `reference/xxx.md` 能按资源基址解析。
- 注册全部包在 `ctx.effect()` 里：**关掉插件行或卸载 bundle，技能自动注销**，不会残留。

不需要文件系统扫描、不需要绝对路径、不需要重启。

## 与 Claude Code / Codex 插件的差异

| 上游（Claude Code / Codex） | 本插件（DeepSeek Harness） |
|---|---|
| `Bash` 工具 | `pwsh`（Windows）或 `bash` |
| `Read` / `Write` / `Edit` | `read` / `write` / `edit` |
| `python - <<'PY' … PY` heredoc | 先用 `write` 落成 `explore_<n>.py`，再用 `pwsh` 跑 |
| `/cuawright:run`、`/cuawright:craft` 斜杠命令 | 无斜杠命令；靠描述自动激活，“做成可复用 CLI”触发参数化模式 |
| `image_qa` / `self_reflection` 工具 | 宿主原生读图 + 对 `plan.md` 自检（无需额外 Key） |

另外补了两条 Windows 实战规则：

- **控制台编码**：Windows 控制台默认 GBK，打印含非 ASCII 的 `aria_snapshot()` 会抛 `UnicodeEncodeError`，需 `$env:PYTHONIOENCODING = "utf-8"` 或脚本内 `sys.stdout.reconfigure(encoding="utf-8", errors="replace")`。
- **引擎选择**：Chromium 优先，遇 `ERR_HTTP2_PROTOCOL_ERROR` 才换 Firefox，并在日志里记录切换。

## 维护

| 目的 | 做法 |
|---|---|
| 关掉（两个技能立刻从目录消失） | **Plugins** 关掉 `cuawright` 行；或 `plugin_manager set_plugin enabled:false target:include:cuawright` |
| 重新打开 | 同上，`enabled:true` |
| **改了 `SKILL.md` / `reference/*.md`** | 必须“关→开”一次：技能正文在插件激活时读取并注册，改文件不会热更新 |
| 卸载 | `plugin_manager remove_bundle target:dsh-cuawright` |
| 升级 | 拉取本仓库更新后“关→开”；`index.js` 改动需要重装 bundle 才能加载新的模块代 |

本仓库与上游检出里的 `dsh-plugin/` 目录内容一致；两者同时存在时，以本仓库为准，`dsh-plugin/` 是它在 CUAWright 检出里的落位。

## 排错

| 现象 | 处理 |
|---|---|
| 技能目录里没有 `cuawright-web` | 确认 `cuawright` 行是开启状态；确认 `skills/cuawright-web/SKILL.md` 存在且 frontmatter 有 `name` 和 `description` |
| `Executable doesn't exist … chromium` | `python -m playwright install chromium` |
| `ERR_HTTP2_PROTOCOL_ERROR` / 站点拒绝 Chromium | `python -m playwright install firefox`，把该脚本的 `launch` 换成 firefox，并在操作日志记录切换 |
| `UnicodeEncodeError: 'gbk' codec can't encode …` | 设 `$env:PYTHONIOENCODING = "utf-8"`，或在脚本顶部 `sys.stdout.reconfigure(encoding="utf-8", errors="replace")` |
| 桌面技能报找不到 `cuawright` 命令 | 在上游检出里 `python -m pip install -e ".[desktop]"`，并设 `CUAWRIGHT_ROOT` 指向该检出 |
| 桌面任务没有分数 | 只有 `cuawright desktop reproduce osworld` 才有评测分；`desktop run` 不评分 |

## 许可

MIT。技能文本派生自 [microsoft/CUAWright](https://github.com/microsoft/CUAWright)，`LICENSE` 保留上游版权声明，`NOTICE` 记录归属；本仓库新增的插件层代码同样以 MIT 发布。
