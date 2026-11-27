# Robot Framework 套件骨架（通用自动化项目框架 v6.0）

下面是已在框架内跑通过的写法（`--dryrun` 与真跑均通过）。照抄骨架，替换业务部分。

## 最小可跑套件

```robot
*** Settings ***
Documentation     打开示例站点并校验标题与主链接
Resource          ../05数据/00引用/11网页端-Browser.resource
Test Teardown     网页端PW 关闭浏览器
Test Tags         冒烟测试

*** Variables ***
${目标URL}        https://example.com    # 本次任务的外部地址，来源：用户给定

*** Test Cases ***
示例站点 标题与主链接正确
    [Documentation]    打开目标站点，校验标题，取主链接，截图存证
    ...    ---
    ...    创建用户：<你的名字>
    ...    创建时间：<yyyy-MM-dd>
    网页端PW 打开浏览器    ${目标URL}    是否无头模式=True    最大等待时间=30s
    ${页面标题}    Browser.Get Title
    Should Be Equal    ${页面标题}    Example Domain
    ${主链接}    Browser.Get Attribute    css=a    href
    Should Contain    ${主链接}    iana.org
    Browser.Take Screenshot    ${OUTPUT DIR}${/}screenshots${/}CP1_标题与主链接.png    fullPage=False
```

要点：

- `Resource` 路径相对**套件自身**位置。套件放 `01测试用例/` 时即 `../05数据/00引用/11网页端-Browser.resource`。
- `Test Teardown` 固定 `网页端PW 关闭浏览器`，避免浏览器残留。
- `是否无头模式=True` 适合无人值守；要看界面时传 `False`。
- 截图写到 `${OUTPUT DIR}${/}screenshots${/}…`：`${OUTPUT DIR}` 是本次 `--outputdir` 的绝对路径（**不带**尾部斜杠），不用自己拼工作区路径。

## 能力入口怎么选

| 入口 | 适用 |
|---|---|
| `05数据/00引用/11网页端-Browser.resource` | **默认**。Playwright(Browser) + `03操作网页端-Browser` + `00基础` |
| `05数据/00引用/10网页端-Selenium.resource` | 只能用 Selenium 的老站点/老浏览器驱动 |
| `04技术组件/03操作网页端-Browser.resource` | 只要网页端关键字，不要 `00基础` 那套数据配置时 |

不要引 `05数据/00公共引用.resource`（兼容壳，拉 64 个依赖，含 JVM/JDBC）。

## 打开浏览器

```robot
网页端PW 打开浏览器    ${URL}                               # 默认 chromium，有界面
网页端PW 打开浏览器    ${URL}    是否无头模式=True             # 无头
网页端PW 打开浏览器    ${URL}    浏览器类别=headlesschrome      # 无头（简称写法）
网页端PW 打开浏览器    ${URL}    最大等待时间=30s              # 放大首次等待
网页端PW 打开浏览器    ${URL}    上下文存储路径=${上下文文件}    # 复用 cookie/localStorage
```

`浏览器类别` 可取 `chromium`、`googlechrome`/`chrome`/`gc`、`headlesschrome`、`edge`、`firefox`。完整入参以 `04技术组件/03操作网页端-Browser-03上下文与页面切换.resource` 里 `网页端PW 打开浏览器` 的 `[Documentation]` 为准。

## 常用动作

```robot
网页端PW 跳转网址    ${URL}
网页端PW 等待元素    //div[@id='result']    最大等待时间=15s
网页端PW 等待并点击元素    //button[contains(text(),'查询')]    最大等待时间=10s
网页端PW 等待并输入文本    //input[@placeholder='请输入关键字']    ${关键字}
网页端PW 获取元素文本    //span[@class='price']
${文本}    网页端PW 等待并获取文本    //h1
${属性}    网页端PW 获取元素属性值    //a[@id='main']    href
网页端PW 等待页面包含文字    共 ${条数} 条
网页端PW 页面滚动    0    1200
网页端PW 滚动元素居中    //div[@class='target']
网页端PW 刷新页面
```

选择器优先级：`get_by_role` 等价的语义定位（`css=` 角色/文本）> `aria-label`/`placeholder` 属性 > 稳定的 `id` > 结构 XPath。不要用依赖 nth-child 的脆弱路径。

## 等待与断言

```robot
Wait Until Keyword Succeeds    30s    2s    网页端PW 等待元素    //table//tr[2]
Should Be Equal    ${标题}    ${预期标题}
Should Contain    ${链接}    iana.org
${是否存在}    Run Keyword And Return Status    网页端PW 等待元素    //div[@class='empty']    最大等待时间=5s
IF    ${是否存在}
    Fail    结果为空，但本次任务要求有数据
END
```

- 断言优先用 `Should Be Equal` / `Should Contain` / `Should Match Regexp`；**打印出来看到过不算通过**。
- 需要"存在即通过、不存在不算失败"的判断时用 `Run Keyword And Return Status`，注意里面不能再嵌 `VAR`。

## 截图与证据

```robot
Browser.Take Screenshot    ${OUTPUT DIR}${/}screenshots${/}CP2_筛选条件已应用.png    fullPage=False
```

- **不要** `fullPage=True`（整页长图读不清，也和框架其它证据不一致）。
- 一个 CP 一张图，文件名带 CP 编号与动作，便于逐条核对。
- 选中态在抽屉/弹层关闭后被隐藏时，先重新打开或截一张可见的 chip/summary，再当作已验证。

## 新封装关键字

```robot
*** Keywords ***
购物 按价格区间筛选
    [Documentation]    在商品列表页设置价格区间并应用
    ...    ---
    ...    入参：
    ...    - `最低价`：价格下限（元）
    ...    - `最高价`：价格上限（元）
    ...    ---
    ...    出参：
    ...    - 无
    ...    ---
    ...    示例：
    ...    | 购物 按价格区间筛选 | 300 | 500 |
    ...    ---
    ...    创建用户：<你的名字>
    ...    创建时间：<yyyy-MM-dd>
    [Arguments]    ${最低价}    ${最高价}
    网页端PW 等待并点击元素    //span[text()='价格']    最大等待时间=10s
    网页端PW 等待并输入文本    //input[@name='priceMin']    ${最低价}
    网页端PW 等待并输入文本    //input[@name='priceMax']    ${最高价}
    网页端PW 等待并点击元素    //button[text()='确定']    最大等待时间=10s
```

命名 `模块名 功能描述`，中文空格分隔；`[Documentation]` 必须有，模板见 `.repo_wiki/编码规范.md`。

## 运行、干跑、静态检查

```pwsh
# 干跑：只解析不执行，关键字/参数/资源路径写错在这一步暴露
python -m robot --dryrun --outputdir .tmp\<task_id>\dryrun 01测试用例\<套件>.robot

# 真跑
python -m robot --outputdir .tmp\<task_id>\final_runs\run_1 01测试用例\<套件>.robot

# 只跑某个用例 / 某类标签
python -m robot --test "示例站点 标题与主链接正确" 01测试用例\<套件>.robot
python -m robot --include 冒烟测试 01测试用例\<套件>.robot

# 静态检查（可选，robocop 6.x 子命令制）
$env:PYTHONIOENCODING='utf-8'
python -m robocop check --config 04技术组件\09工具\Robocop\robot.toml 01测试用例\<套件>.robot
```

退出码：`0` 全通过、`1–249` 失败用例数、`250` 以上为命令/语法错误。**看退出码，不要只看最后几行输出。**

## 常见报错

| 报错 | 原因与处理 |
|---|---|
| `Executable doesn't exist … playwright-core\.local-browsers\…` | Browser 库没初始化：跑一次 `rfbrowser init`（离线机器要预置该目录） |
| `No keyword with name 'VAR' found` | RF 版本 < 7.0，或把 `VAR` 塞进了 `Run Keyword If` / `Run Keyword And Return Status` 的参数 |
| `No keyword with name '网页端PW …' found` | 关键字名写错或没引能力入口；按 `Select-String -Path 04技术组件\03操作网页端-Browser*.resource -Pattern '^网页端PW '` 核对 |
| `Resource file … does not exist` | `Resource` 相对路径算错；套件在 `01测试用例/` 时是 `../05数据/00引用/11网页端-Browser.resource` |
| `Variable '${…}' not found` | 变量没定义或拼错；框架自带 `${项目根目录}`、`${默认等待时间}`、`${环境}` |
| `UnicodeEncodeError: 'gbk' codec can't encode …` | 控制台编码：`$env:PYTHONIOENCODING='utf-8'` |
| 浏览器起来就失败，日志里 TLS/H2 报错 | 该站点拒绝 Chromium，换 `浏览器类别=firefox` 或 `edge` 重试，并在报告里说明 |
