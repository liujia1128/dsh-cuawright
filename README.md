# dsh-cuawright

把 [CUAWright](https://github.com/microsoft/CUAWright)（原 Webwright）的网页/桌面自动化能力做成 **DeepSeek Harness（DSH）插件**，并且把网页侧的产物从 **Python 脚本改成 Robot Framework 套件**——直接落在现有的「通用自动化项目框架 v6.0」里，复用它的能力入口、`网页端PW` 关键字、环境变量与 robocop 门禁。

装上之后技能目录里多出两个技能：

| 技能 | 产物 | 说明 |
|---|---|---|
| `cuawright-web` | `01测试用例/<中文描述>.robot` | 在框架约定下写 `.robot` 用例，用 `网页端PW`（Playwright/Browser）关键字一步步驱动浏览器，截图证据写进 robot 输出目录 |
| `cuawright-desktop` | `manifest.json` / `trace.jsonl` / `result.json` | 通过 `cuawright desktop` 命令行在 OSWorld-V2 Ubuntu 虚拟机里跑任务或复现官方评分 |

浏览器流程由**宿主智能体原生驱动**，不需要额外的模型 API Key；桌面流程驱动 CUAWright 自己的 Actor 循环，需要它自己的 Responses API Key。

## 来源与关系

本仓库 fork 自 [microsoft/CUAWright](https://github.com/microsoft/CUAWright)，只发布 **DSH 插件层**：上游的 Python 运行时（`src/cuawright/`、OSWorld 复现脚本、基准数据）不在本仓库。

- 技能文本派生自上游 `skills/cuawright-web/`，并按 DSH 工具名 + Robot Framework 产物改写。
- `index.js`、`package.json`、`locale/`、`icon.svg` 为本仓库新增。
- 网页侧的框架约定来自「通用自动化项目框架 v6.0」（陕西农信，RF 7.x），不是本仓库的代码，本仓库只引用其入口与关键字。

## 目录结构

```text
dsh-cuawright/
├── package.json          # bundle 清单：dsh.bundle.patch + locale/icon 导出
├── cordis.patch.yml      # 插入一行 Host 插件：id=cuawright, name=dsh-cuawright
├── index.js              # Host 插件：注册 skills/*/SKILL.md，替换两个根路径占位符
├── skills/
│   ├── cuawright-web/
│   │   ├── SKILL.md
│   │   └── reference/
│   │       ├── rf_suite_patterns.md      # 套件骨架、关键字清单、断言与截图写法
│   │       ├── workflow.md               # 计划→探针→套件→运行→自检
│   │       └── parameterized_mode.md     # *** Variables *** + --variable 契约
│   └── cuawright-desktop/
│       └── SKILL.md
├── locale/{en,zh}.json   # 插件管理器标题与描述
├── icon.svg              # 36×36 图标
├── README.md / INSTALL.md
├── LICENSE / NOTICE      # MIT + 上游归属
```

## 安装

### 插件管理器界面

1. **Plugins** → **Add plugin** → 选择本仓库目录（或解压后的 `dsh-cuawright` 目录）。
2. 确认出现 `cuawright` 一行。

### 智能体工具

```text
plugin_manager  action: install_bundle  target: <本仓库绝对路径>
```

返回 `application: applied` 即生效（新装 bundle 通过 HMR 激活，不需要重启）。

### 离线安装

拿 `dist/dsh-cuawright-<version>.zip`，解压到固定路径后按上面任一方式安装；离线机器还要预置 Browser 库的 node 与 Playwright 浏览器。详见 [INSTALL.md](INSTALL.md)。

## 配置：告诉插件框架在哪

网页技能要往「通用自动化项目框架」里写用例，所以需要知道它的根目录（含 `04技术组件/` 的那一层）。两种给法，二选一：

**A. profile 补丁里配**（推荐，长期有效）。在 profile 的 `cordis.patch.yml` 加：

```yaml
- id: cuawright
  name: dsh-cuawright
  config:
    rfFrameworkRoot: D:/workspace/rf_workspace/通用自动化项目框架v6.0_20260804
```

**B. 环境变量**：`RF_FRAMEWORK_ROOT=D:\workspace\rf_workspace\通用自动化项目框架v6.0_20260804`。

都不配时，技能正文里的框架根会显示成 `<通用自动化项目框架根目录>`，智能体会先问你框架在哪，而不是猜一个路径。改完配置要在 Plugins 里把 `cuawright` 关→开一次让技能正文重新渲染。

## 依赖

网页技能（在**运行 DSH 的机器**上）：

```pwsh
python -m robot --version        # 必须 ≥ 7.0（现场 7.4.2）
rfbrowser init                   # Browser 库初始化：node + Playwright 浏览器，约 150 MB
```

- 框架自身的依赖按它的 `requirements.txt` 装。
- `rfbrowser init` 只做一次；离线机器要预置 `site-packages\Browser\wrapper\node_modules\playwright-core\.local-browsers\`。
- 静态检查可选：`python -m robocop check --config 04技术组件/09工具/Robocop/robot.toml <套件>`。

桌面技能额外需要：Python 3.12+、Docker、上游 CUAWright 检出、Responses 兼容 API Key、两个 gated 数据集的授权（见上游 `REPRODUCE.md`）。

## 使用

### 网页任务

直接说任务，技能按描述自动激活：

```text
帮我上京东搜「机械键盘」，价格 300-500，只看自营，按销量排序，
把前三名的名称、价格、销量截图存下来，最后告诉我最便宜的那个。
```

它会把任务拆成关键点写 `plan.md`，先写探针套件 `--dryrun`，再在 `01测试用例/` 落最终 `.robot`，运行并把截图写进 `final_runs/run_1/screenshots/`，然后逐张读图自检。

### 参数化（可复用用例）

```text
…同上，但做成可复用的：关键字、价格区间、排序方式都放 *** Variables ***，
以后能 robot --variable "关键字:静音鼠标" 复跑。
```

契约见 `skills/cuawright-web/reference/parameterized_mode.md`：默认值等于本次任务值，不带 `--variable` 必须复现原任务。

### 桌面任务

```text
用 cuawright-desktop 帮我在 VM 里创建 /home/user/notes.txt，写三行会议准备清单，然后重新打开校验。
```

### 产物与验收

```text
<框架根>/
├── 01测试用例/<中文描述>.robot          # 最终套件（可复跑、可归档）
└── .tmp/<task_id>/
    ├── plan.md                          # 关键点 CP1..CPn
    ├── screenshots/                     # 探索期截图
    └── final_runs/run_1/
        ├── output.xml / log.html / report.html
        └── screenshots/CP1_*.png        # 每个 CP 的证据
```

验收看三处：`report.html` 该用例 PASS、`final_runs/run_1/screenshots/` 里 CP 截图齐全且能证明约束、`plan.md` 每个 CP 都指得出证据。

## 工作原理

`index.js` 导出一个 Host 插件：

```js
export const inject = ['skills']
export function apply(ctx, config) { /* 遍历 skills/*/SKILL.md 并注册 */ }
```

- 遍历 `skills/*/SKILL.md`，解析 `---` 之间的 frontmatter（`name`、`description`、`whenToUse`）。
- 用 `ctx.skills.register()` 注册，`source: 'custom'`，`resourceBase` 指向该技能目录，所以正文里写的 `reference/xxx.md` 能按资源基址解析。
- 注册全部包在 `ctx.effect()` 里：**关掉插件行或卸载 bundle，技能自动注销**。
- 注册前替换两个占位符：`{{RF_FRAMEWORK_ROOT}}`（框架根，来自 `config.rfFrameworkRoot` 或环境变量 `RF_FRAMEWORK_ROOT`）、`{{CUAWRIGHT_ROOT}}`（CUAWright 检出，来自 `CUAWRIGHT_ROOT` 或插件相邻目录）。

不需要文件系统扫描、不需要绝对路径写死、不需要重启。

## 与上游 Claude Code / Codex 插件的差异

| 上游（Claude Code / Codex） | 本插件（DeepSeek Harness） |
|---|---|
| 产物 `final_script.py`（Playwright Python） | 产物 `01测试用例/<中文描述>.robot`（框架的 `网页端PW` 关键字） |
| `Bash` 工具 | `pwsh`（Windows）或 `bash` |
| `Read` / `Write` / `Edit` | `read` / `write` / `edit` |
| `/cuawright:run`、`/cuawright:craft` 斜杠命令 | 无斜杠命令；靠描述自动激活，“做成可复用的”触发参数化模式 |
| `image_qa` / `self_reflection` | 宿主原生读图 + 对 `plan.md` 自检（无需额外 Key） |

另外补了三条实战规则：

- **先 `--dryrun`**：关键字不存在、参数名写错、`Resource` 路径不对，干跑就该暴露，不要靠真跑去撞。
- **截图路径**统一 `${OUTPUT DIR}${/}screenshots${/}CP<n>_<动作>.png`（`${OUTPUT DIR}` 是本次 `--outputdir`，不带尾部斜杠），且 `fullPage=False`。
- **RF 7.x 语法**：`VAR` 赋值、`RETURN` 返回、`IF … END` 分支；`VAR` 不能塞进 `Run Keyword If` / `Run Keyword And Return Status` 的参数里。

## 维护

| 目的 | 做法 |
|---|---|
| 关掉（两个技能立刻从目录消失） | **Plugins** 关掉 `cuawright` 行；或 `plugin_manager set_plugin enabled:false target:include:cuawright` |
| 重新打开 | 同上 `enabled:true` |
| **改了 `SKILL.md` / `reference/*.md`** | 必须“关→开”一次：技能正文在插件激活时读取并注册，改文件不会热更新 |
| 改了配置（框架根） | 同样“关→开”一次才会重新渲染正文 |
| 卸载 | `plugin_manager remove_bundle target:dsh-cuawright` |
| 升级 | 覆盖目录后“关→开”；`index.js` 改动需重装 bundle 或重启 DSH |

## 排错

| 现象 | 处理 |
|---|---|
| 技能目录里没有 `cuawright-web` | `cuawright` 行没开启；或 `SKILL.md` frontmatter 缺 `name`/`description` |
| 技能正文里框架根显示成 `<通用自动化项目框架根目录>` | 没配 `rfFrameworkRoot` 或 `RF_FRAMEWORK_ROOT`，见“配置” |
| `Executable doesn't exist … playwright-core\.local-browsers\…` | Browser 库没初始化：`rfbrowser init`（离线要预置该目录） |
| `No keyword with name 'VAR' found` | RF < 7.0，或把 `VAR` 塞进了 `Run Keyword If` / `Run Keyword And Return Status` 的参数 |
| `No keyword with name '网页端PW …' found` | 关键字名写错或没引能力入口；`Select-String -Path 04技术组件\03操作网页端-Browser*.resource -Pattern '^网页端PW '` 现查 |
| `Resource file … does not exist` | 套件在 `01测试用例/` 时应为 `../05数据/00引用/11网页端-Browser.resource` |
| `UnicodeEncodeError: 'gbk' codec …` | `$env:PYTHONIOENCODING='utf-8'` |

## 许可

MIT。技能文本派生自 [microsoft/CUAWright](https://github.com/microsoft/CUAWright)，`LICENSE` 保留上游版权声明，`NOTICE` 记录归属；本仓库新增的插件层代码同样以 MIT 发布。
