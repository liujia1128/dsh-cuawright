---
name: cuawright-web
description: 以“代码即动作”的方式完成网页任务——直接在「通用自动化项目框架 v6.0」的约定下编写 Robot Framework 测试套件，用框架的 网页端PW（Playwright/Browser）关键字一步步驱动浏览器，再依据 robot 的日志与套件写入输出目录的截图逐条自检。
whenToUse: 用户要求自动化一个网页任务（搜索、筛选、填表、多步流程、数据提取、比价），并且要产出符合现有「通用自动化项目框架 v6.0」的 .robot 用例、可复跑可归档，而不是一段独立的 Python 脚本。
---

# CUAWright 网页技能（Robot Framework 版）

上游 CUAWright（原 Webwright）的网页技能产出的是 `final_script.py`。本插件改成**直接产出 Robot Framework 套件**，落在「通用自动化项目框架 v6.0」里，复用它的能力入口、`网页端PW` 关键字、环境变量和 robocop 门禁。

工作区契约不变（`plan.md`、`final_runs/run_<id>/`、截图、动作日志），变的是产物形态：`.robot` 而不是 `.py`，证据来自 robot 的 `log.html` 加上套件自己写的 PNG。

## 产物

| 项 | 位置 |
|---|---|
| 关键点清单 | `<工作区>/plan.md` |
| 最终套件 | `{{RF_FRAMEWORK_ROOT}}/01测试用例/<中文描述>.robot` |
| 运行输出 | `<工作区>/final_runs/run_<id>/`（`output.xml`、`log.html`、`report.html`） |
| 证据截图 | `<工作区>/final_runs/run_<id>/screenshots/CP<n>_<动作>.png` |

`<工作区>` 默认 `{{RF_FRAMEWORK_ROOT}}/.tmp/<task_id>/`（框架里 `.tmp/` 就是临时目录）；用户指定了别的路径就按用户的。

## 前置条件

- **框架根**：`{{RF_FRAMEWORK_ROOT}}`。解析不到时先问用户框架在哪，不要猜路径。
- **Robot Framework ≥ 7.0**（现场 7.4.2）：`python -m robot --version`。
- **Browser 库首次使用要初始化**：`rfbrowser init`（下载 node 与 Playwright 浏览器，约 150 MB）。离线机器必须预置，否则报 `Executable doesn't exist … playwright-core\.local-browsers\…`。
- **可选静态检查**：`python -m robocop check --config 04技术组件/09工具/Robocop/robot.toml <套件>`（本机 robocop 是 6.x 子命令制，PowerShell 下先 `$env:PYTHONIOENCODING='utf-8'`）。

## 必须引用的能力入口

新文件**不要**再引 `05数据/00公共引用.resource`（那是兼容壳，一次拉 64 个依赖）。网页 Playwright 只引这一行：

```robot
Resource    ../05数据/00引用/11网页端-Browser.resource
```

路径相对套件自身位置：套件放在 `01测试用例/` 时就是上面这一行。它自带 `00基础`（RF 标准库 + 数据配置）与 `03操作网页端-Browser`，因此 `${项目根目录}`、`${默认等待时间}`、`${环境}` 都可直接用。

## 关键字清单（只用真实存在的，不要自己编）

框架已封装（前缀 `网页端PW`）：

| 场景 | 关键字 |
|---|---|
| 开关浏览器 | `网页端PW 打开浏览器`、`网页端PW 关闭浏览器`、`网页端PW 关闭所有浏览器` |
| 导航 | `网页端PW 跳转网址`、`网页端PW 刷新页面`、`网页端PW 打开标签页`、`网页端PW 切换页面` |
| 等待 | `网页端PW 等待元素`、`网页端PW 等待页面包含文字`、`网页端PW 等待直到元素变为指定状态`、`网页端PW 等待直到元素文本可见` |
| 交互 | `网页端PW 等待并点击元素`、`网页端PW 等待并输入文本`、`网页端PW 操作坐标`、`网页端PW 页面滚动`、`网页端PW 滚动元素居中` |
| 取值 | `网页端PW 获取元素文本`、`网页端PW 等待并获取文本`、`网页端PW 获取元素属性值`、`网页端PW 获取元素个数和信息` |
| 弹窗/文件 | `网页端PW 处理弹窗`、`网页端PW 获取弹窗消息`、`网页端PW 上传文件`、`网页端PW 下载文件` |
| 其他 | `网页端PW 执行js代码`、`网页端PW 依次切换iframe`、`网页端PW 启动监听接口响应`、`网页端PW 接收接口响应` |

Browser 库可直接调用（`Browser.` 前缀）：`Browser.Get Title`、`Browser.Take Screenshot`、`Browser.Get Attribute`、`Browser.Hover`、`Browser.Select Options`、`Browser.Keyboard Key`、`Browser.Wait For Elements State`。

完整参数与示例见 `reference/rf_suite_patterns.md`；拿不准时现查：

```pwsh
Select-String -Path 04技术组件\03操作网页端-Browser*.resource -Pattern '^网页端PW ' | Select-Object -ExpandProperty Line
```

## 语法硬规则（框架门禁会卡）

- 赋值一律 `VAR`，不要 `Set Variable` / `Create List` / `Create Dictionary`。
- 返回用 `RETURN`，不要 `[Return]`。
- 分支 `IF … END`、循环 `FOR … END`，不要 `Run Keyword If` / `:FOR`。
- `VAR` 是语句不是关键字，**不能**塞进 `Run Keyword If` / `Run Keyword And Return Status` 的参数里；那种位置保留 `Set Variable`。
- 关键字命名 `模块名 功能描述`（中文，空格分隔）；新关键字必须有 `[Documentation]` 块（功能 / 入参 / 出参 / 示例 / 创建维护）。
- 地址、账号、等待时长走变量或 `${环境数据${环境}}[...]`，**不要硬编码**；本次任务的外部 URL 放 `*** Variables ***` 并注释来源。
- 用例名用中文业务描述；标签用裸名（`冒烟测试`、`回归测试`），不要逗号分隔。

## 工作流

1. **计划**：把任务拆成关键点 CP1..CPn，写 `<工作区>/plan.md`。每个 CP 必须能被一张截图或一条断言独立证明。
2. **探针**：先写最小 `.robot` 摸清选择器与控件是否存在，`python -m robot --dryrun` 过一遍语法，再真跑。探索期截图存 `<工作区>/screenshots/`。
3. **写套件**：在 `01测试用例/<中文描述>.robot` 落最终套件，按 `reference/rf_suite_patterns.md` 的骨架；每个 CP 一张截图 + 一条断言。
4. **运行**：在框架根执行
   `python -m robot --outputdir .tmp/<task_id>/final_runs/run_<id> 01测试用例/<中文描述>.robot`
   失败就改套件，换 `run_<id+1>/` 重跑，不要在同一目录堆残迹。
5. **自检**：逐个 CP 读 `<运行输出>/screenshots/CP<n>_*.png`，确认证据无歧义；同时确认 `output.xml` 里该用例 PASS。有 CP 无证据或证据模糊，就回到第 3 步。
6. **收尾**：报告最终数据 + 套件路径 + 运行输出路径；如做了参数化，说明怎么用 `--variable` 复跑。

## 硬规则

- **一条 shell 命令一步**，看到输出再发下一条。
- **写完先 `--dryrun`**：关键字不存在、参数名写错、资源路径不对，这一步就该暴露，不要靠真跑去撞。
- **截图一律** `Browser.Take Screenshot    ${OUTPUT DIR}${/}screenshots${/}CP<n>_<动作>.png    fullPage=False`；不要整页长图（`${OUTPUT DIR}` 是本次 `--outputdir` 的绝对路径，不带尾部斜杠）。
- **断言优先** `Should Be Equal` / `Should Contain` / `Wait Until Keyword Succeeds`；“打印出来看到了”不算通过。
- 站点有专门的筛选/排序控件就**必须**用它，搜索框代替不了显式筛选；排序类要求必须落到站点自己的排序控件。
- 数值、日期、数量、单位必须精确，宽口径算失败。
- 选中态在抽屉/弹层关闭后被隐藏时，重新打开或先截一张可见的 chip/summary 再当作已验证。
- 不要 `pip install` 新库；框架依赖已钉版（`requirements.txt`）。
- **不要改框架的公共组件**（`04技术组件/`、`05数据/`）。要新封装就写在自己套件的 `*** Keywords ***` 里。

## 参考文件

- `reference/rf_suite_patterns.md` — 套件骨架、能力入口、关键字参数、截图与断言写法、运行/干跑/静态检查命令、常见报错。
- `reference/workflow.md` — plan → 探针 → 套件 → 运行 → 自检 的逐步展开与完成判据。
- `reference/parameterized_mode.md` — 参数化套件（`*** Variables ***` + `--variable` + `--argumentfile`）的契约与验收。
