# dsh-cuawright 离线安装说明

本包是 **DeepSeek Harness（DSH）插件** `dsh-cuawright` 的离线安装包。装好后技能目录里增加两个技能：

- `cuawright-web` — 在「通用自动化项目框架 v6.0」的约定下**生成 Robot Framework 套件**（`.robot`），用框架的 `网页端PW`（Playwright/Browser）关键字驱动浏览器。
- `cuawright-desktop` — 通过 `cuawright desktop` 命令行在 OSWorld-V2 Ubuntu 虚拟机里跑桌面任务。

插件本身是纯 JavaScript + Markdown，无 npm 依赖、无编译产物，安装不需要联网；但**网页技能运行**需要目标机具备 Robot Framework 环境与框架本体（见第 2 节）。

---

## 1. 包内容

解压后是一个目录（**目录名保持 `dsh-cuawright`**）：

```text
dsh-cuawright/
├── package.json          # bundle 清单（dsh.bundle.patch）
├── cordis.patch.yml      # 插入一行 Host 插件：id=cuawright
├── index.js              # 注册 skills/*/SKILL.md，替换两个根路径占位符
├── skills/
│   ├── cuawright-web/
│   │   ├── SKILL.md
│   │   └── reference/{rf_suite_patterns,workflow,parameterized_mode}.md
│   └── cuawright-desktop/SKILL.md
├── locale/{en,zh}.json   # 插件管理器标题与描述
├── icon.svg              # 36×36 插件图标
├── README.md             # 功能、配置、用法
├── INSTALL.md            # 本文件
├── LICENSE / NOTICE      # MIT + 上游归属
```

校验（与 zip 同目录的 `.sha256` 文件一致）：

```pwsh
Get-FileHash .\dsh-cuawright-0.2.0.zip -Algorithm SHA256
```

---

## 2. 目标环境要求

| 项 | 要求 | 说明 |
|---|---|---|
| DSH Desktop | 0.2.x 及以上 | 需要 bundle 机制与 `ctx.skills` 技能注册服务 |
| 操作系统 | Windows / macOS / Linux | 技能正文以 Windows `pwsh` 为主，其它平台用等价命令 |
| **Robot Framework** | **≥ 7.0**（现场 7.4.2） | 框架用 `VAR` 赋值语法，低于 7.0 会在 setup 报 `No keyword with name 'VAR' found` |
| **通用自动化项目框架 v6.0** | 目标机上要有检出 | 网页技能的产物落进它的 `01测试用例/`，并引它的 `05数据/00引用/11网页端-Browser.resource` |
| Browser 库 | `rfbrowser init` 过一次 | 下载 node 与 Playwright 浏览器（约 150 MB）；不初始化会报 `Executable doesn't exist … .local-browsers\…` |
| robocop（可选） | 6.x | `python -m robocop check --config 04技术组件/09工具/Robocop/robot.toml <套件>` |
| 桌面技能 | Python 3.12+、Docker、CUAWright 检出、Responses API Key | 只装不用可以不准备 |

### 离线机器上的 Browser 库

`rfbrowser init` 需要联网。离线目标机的做法二选一：

1. **预置浏览器目录**：在有网机器上装好同版本 `robotframework-browser` 后执行 `rfbrowser init`，把
   `<Python>\Lib\site-packages\Browser\wrapper\node_modules\playwright-core\.local-browsers\` 整个目录拷到目标机同一位置。
2. **内网镜像**：把 `robotframework-browser` 的 wheel 与上述浏览器目录一起放进内网源，按内网流程安装。

注意：Python 侧的 `python -m playwright install chromium`（缓存到 `%LOCALAPPDATA%\ms-playwright`）**不能**替代这一步——Browser 库用的是它自己 `site-packages` 里那份 playwright-core 和浏览器版本。

---

## 3. 安装（推荐：插件管理器界面）

1. **解压到固定路径**，例如 `C:\dsh-plugins\dsh-cuawright`。
   ⚠️ 安装后 DSH 的 profile 会**链接**到这个路径，之后移动或删除目录会让插件失效。
2. DSH Desktop → **Plugins** → **Add plugin** → 选择解压出来的 `dsh-cuawright` 目录。
3. 在 **Plugins** 列表确认出现 `cuawright` 一行（标题 CUAWright，状态开启）。
4. **新开会话**，技能目录里应出现 `cuawright-web` 与 `cuawright-desktop`。
5. **配置框架根**（见第 4 节），否则技能正文里的框架路径会显示成占位符。
6. 跑一次冒烟（见第 6 节）。

---

## 4. 配置：框架根（必做）

网页技能要往「通用自动化项目框架 v6.0」里写用例，必须知道它的根目录（含 `04技术组件/` 的那一层）。二选一：

**A. profile 补丁（推荐）** — 在 `%DSH_HOME%\profiles\<profile>\cordis.patch.yml` 追加：

```yaml
- id: cuawright
  name: dsh-cuawright
  config:
    rfFrameworkRoot: D:/workspace/rf_workspace/通用自动化项目框架v6.0_20260804
```

**B. 环境变量** — `RF_FRAMEWORK_ROOT=D:\workspace\rf_workspace\通用自动化项目框架v6.0_20260804`（要在启动 DSH 的环境里生效）。

配完后在 **Plugins** 里把 `cuawright` **关→开**一次，技能正文才会重新渲染。

未配置时技能不会猜路径：正文里显示 `<通用自动化项目框架根目录>`，智能体会先问用户框架在哪。

---

## 5. 安装（备选：让智能体装）

```text
plugin_manager  action: install_bundle  target: C:\dsh-plugins\dsh-cuawright
```

返回 `application: applied` 即生效；`failed` 时看 `error.diagnostic` 与 `nextStep`。

### 完全离线环境的回退安装

`install_bundle` 会在 profile 里跑一次 `pnpm install`。本插件是本地目录（`link:`）依赖、自身零下载，但 pnpm 可能仍会解析 profile 里其它既有依赖。若内网彻底无外网导致失败，用等价的手工步骤：

1. 建目录链接（Windows junction 不需要管理员）：

   ```pwsh
   cmd /c mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-cuawright" "C:\dsh-plugins\dsh-cuawright"
   ```

   macOS / Linux：`ln -s /opt/dsh-plugins/dsh-cuawright ~/.dsh/profiles/desktop/node_modules/dsh-cuawright`

2. 改 profile 的 `package.json`（先备份）：
   - `dependencies` 加 `"dsh-cuawright": "link:C:/dsh-plugins/dsh-cuawright"`
   - `dsh.profile.bundles` 末尾加 `"dsh-cuawright"`

3. 重启 DSH Desktop，在 **Plugins** 确认 `cuawright` 一行。

4. 后续若某次操作触发 pnpm 重装并回退了这两处改动，改用界面安装（有内网 npm 镜像时最稳）。

---

## 6. 验证清单

- [ ] **Plugins** 出现 `cuawright`，标题 CUAWright，描述提到 Robot Framework，图标为窗口 + 提示符。
- [ ] 新会话技能目录里能看到 `cuawright-web`、`cuawright-desktop`。
- [ ] `cuawright-web` 正文里的框架根是真实路径（不是 `<通用自动化项目框架根目录>`）。
- [ ] 环境自检（在框架根执行）：

  ```pwsh
  python -m robot --version                     # ≥ 7.0
  python -m robot --dryrun 01测试用例\<任意现有套件>.robot
  ```

- [ ] 冒烟任务：

  ```text
  用 cuawright-web 技能，在通用自动化项目框架里写一个套件：打开 example.com，
  校验标题为 Example Domain，取主链接并截图，输出到 .tmp/smoke/。
  ```

  预期：`01测试用例/` 下出现新套件；`.tmp/smoke/final_runs/run_1/` 下有 `output.xml`、`log.html`、`report.html` 与 `screenshots/CP1_*.png`；`report.html` 里该用例 PASS。
- [ ] 把 `cuawright` 行关掉后两个技能立刻消失；再打开又回来（证明注册是 effect，卸载干净）。

---

## 7. 常见问题

| 现象 | 原因与处理 |
|---|---|
| 技能目录里没有 `cuawright-web` | `cuawright` 行没开启；或 `skills/cuawright-web/SKILL.md` frontmatter 缺 `name`/`description` |
| 技能正文里框架根是 `<通用自动化项目框架根目录>` | 没配 `rfFrameworkRoot` 或 `RF_FRAMEWORK_ROOT`；配完要“关→开”一次 |
| `Executable doesn't exist … playwright-core\.local-browsers\…` | Browser 库没初始化：`rfbrowser init`；离线机器按第 2 节预置目录 |
| `No keyword with name 'VAR' found` | RF < 7.0，或把 `VAR` 塞进了 `Run Keyword If` / `Run Keyword And Return Status` 的参数 |
| `No keyword with name '网页端PW …' found` | 关键字名写错或没引能力入口；用 `Select-String -Path 04技术组件\03操作网页端-Browser*.resource -Pattern '^网页端PW '` 现查 |
| `Resource file … does not exist` | 套件放在 `01测试用例/` 时应为 `../05数据/00引用/11网页端-Browser.resource` |
| 浏览器起来就失败、日志里 TLS/H2 报错 | 该站点拒绝 Chromium，改用 `浏览器类别=firefox` 或 `edge` 重试，并在报告里说明 |
| `UnicodeEncodeError: 'gbk' codec can't encode …` | `$env:PYTHONIOENCODING='utf-8'` |
| 改了 `SKILL.md` 不生效 | 技能正文在激活时读取一次，需在 Plugins 里“关→开”；改 `index.js` 需重装 bundle 或重启 |
| 桌面技能报找不到 `cuawright` 命令 | 在上游 CUAWright 检出里 `python -m pip install -e ".[desktop]"`，并设 `CUAWRIGHT_ROOT` |

---

## 8. 卸载

- 界面安装：**Plugins** 里关掉 `cuawright`（技能立即消失），或 `plugin_manager remove_bundle target:dsh-cuawright`；随后可删解压目录。
- 手工回退安装：删 `node_modules\dsh-cuawright` 链接，从 `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 移除 `dsh-cuawright`，重启 DSH。

---

## 9. 版本与升级

- 当前版本：`0.2.0`（Robot Framework 版：网页技能产物由 `final_script.py` 改为 `.robot`）。
- 升级：新版本解压覆盖同一路径（或关掉旧行 → 覆盖 → 重新 Add plugin），再“关→开”一次。
- 若新版本改了 `index.js`，需重装 bundle 或重启 DSH 才会加载新的模块代。

---

## 10. 许可与来源

MIT。技能文本派生自 [microsoft/CUAWright](https://github.com/microsoft/CUAWright)（原 Webwright），`LICENSE` 保留上游版权声明，`NOTICE` 记录归属；插件层代码来自 <https://github.com/liujia1128/dsh-cuawright>。网页侧的 Robot Framework 约定来自「通用自动化项目框架 v6.0」，本仓库只引用其入口与关键字，不包含其代码。
