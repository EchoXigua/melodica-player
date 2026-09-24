# Melodica Studio · 口风琴演奏工作台

基于 **Electron + React + Vite + Tailwind CSS 4 + Motion** 的本地桌面应用，使用 **pnpm** 管理依赖。

## 启动

需要 Node.js **22.12+**（本机可用 `nvm use 22`）及 pnpm **10.32.0**。

```sh
pnpm install --frozen-lockfile
pnpm start
```

`pnpm start` 先构建 React 界面，再启动 Electron。字体、图标、脚本均在本地，不依赖远程资源。

开发界面可单独启动浏览器预览：

```sh
pnpm dev
```

打开终端显示的 `http://127.0.0.1:5173/`。浏览器支持简谱编辑、MIDI 导入和有声试听，**不会发送系统键鼠**。有声试听使用本地 Web Audio 合成音色。修改 React 组件可热更新；修改自定义 Hook 的调用结构后可能需要刷新页面。

## 操作

1. 使用左侧我的曲谱，或导入自己的 `.mid` / `.midi` 文件。
2. 编辑简谱、选 MIDI 轨道、调整倍率与移调，音符轨迹会自动更新。
3. 在底部播放器选择“乐谱试听”，点击“开始试听”播放声音；或者选择“键鼠演奏”发送实际输入。默认选中试听。播放中间的主按钮可直接停止，准备与倒计时中可取消；与 F8 同义，再次开始从曲首播放，不是断点续播。
4. 键鼠演奏支持 macOS 和 Windows 桌面端。选择模式后刷新目标列表：Windows 选择具体窗口，Mac 选择应用。Mac 首次使用点击“授权辅助功能”，在系统设置中允许 Melodica Studio；开发模式可能显示 Electron 或启动终端，授权后重启。
5. 手动打开游戏的口风琴界面，开始后在 5 秒内切回选定窗口，松开鼠标和乐器键。

Windows 切离目标窗口、Mac 切离目标应用会自动停止并释放输入。Mac 以应用进程为目标，同一应用内切换窗口不会触发停止。浏览器仅提供编辑、有声试听和手动接收检测。

## 停止与键鼠验证

- Mac 顶排的播放/暂停键可能控制其他播放器，需 Fn+F8 才会发送标准 F8（取决于键盘设置），也可直接用 ⌘+Shift+S。Windows 的备用键是 Ctrl+Shift+S。
- 桌面端检查全局快捷键注册结果；被其他程序占用时，页面底部会提示。浏览器快捷键只在页面聚焦时生效。
- 准备曲谱、倒计时和正在演奏均可停止。原生任务收到停止信号后先释放输入；主进程等待输入进程关闭才确认终止。释放失败会显示错误，不显示正常停止。
- 点击“键鼠测试”打开接收窗口。Mac 或 Windows 上点击大接收区域，鼠标留在区域中并松开按键，5 秒后发送覆盖 8 个琴键和 3 个鼠标按钮的测试曲。
- 测试窗口显示计划事件数、可信接收数、首个差异和未释放输入。自动测试时不要人工按键，避免混入事件。它不把计划播放动画当成输入证据。
- 测试中按 F8 或备用快捷键可取消；切换窗口会触发焦点保护。测试通过仅说明该窗口收到了输入，游戏接收仍需另测。
- 浏览器只允许手动检测接收。自动测试记录整个接收窗口内的真实事件；可信事件仍可能来自人工操作，测试期间请勿操作键鼠。Mac 测试通过不能替代 Windows 游戏内测试。

有声试听支持当前简谱和导入 MIDI 的选定轨道，音色并非游戏原声；当前不支持把 MP3/WAV 自动转成可演奏曲谱。

## 曲谱

```text
// 默认每音一拍，空格分音，竖线方便阅读
1 1 5 5 | 6 6 5:2
<1 <#2 >1 0:2
```

- `1`–`7`：基础音；`<1` / `>1`：低 / 高八度；`#4`：升半音。
- `1:2`：两拍；`1:0.5`：半拍；`0`：休止一拍；`//`：行注释。
- 对应键位：`Z X C V B N M ,`。左键降八度，右键升八度，中键升半音。
- “音高校准”可调整 Z 基准音（默认 MIDI 60，仅为待校准值）、音间隔与鼠标提前量。
- MIDI 使用原文件的速度变化；播放倍率仍生效。和弦同起点取最高音，重叠音截短，转换提示会显示在界面。
- 第一版保持单旋律；超音域或音长太短会报错，不静默漏音。

## 动效与视觉

暖白工作区、深色演奏台、橙色播放反馈。包含分层入场、曲名切换、标签滑动、音符轨迹展开、键位下压、倒计时及弹窗过渡。图表来自真实曲谱时间与音高，支持系统 `prefers-reduced-motion`。

动效方向参考 Awwwards 收录的 [Daydream Player](https://www.awwwards.com/sites/daydream-player) 与 [Animated Parallax Page Transition](https://www.awwwards.com/inspiration/animated-page-transisiton-daydream)，采用适合桌面工具的短过渡；没有复制该网站代码或素材。

## 开发命令

```sh
pnpm dev             # 浏览器界面开发
pnpm build           # 构建 build/renderer
pnpm start           # 构建并启动 Electron
pnpm test            # 共享逻辑与架构边界测试
pnpm test:electron   # 构建 + Electron 模拟流程回归
pnpm format          # 格式化源码
pnpm format:check    # 检查格式
pnpm pack:win        # Windows x64 portable
pnpm pack:mac        # macOS DMG 安装包
```

Windows 打包建议在 Windows 上执行。原生输入模块通过系统 Windows PowerShell 5.1 + .NET Framework 加载，使用 Win32 SendInput，不需要 Python 或额外 .NET SDK。`pnpm-workspace.yaml` 仅允许 Electron/esbuild 的安装构建脚本，禁用本项目未使用的 electron-winstaller 安装脚本。

## 目录

```text
src/
  main/                        Electron 主进程
    index.cjs                  窗口、安全配置、退出与 F8 生命周期
    ipc/register.cjs           请求来源校验、返回结果封装、文件对话框
    services/playback.cjs      单播放任务、取消、临时文件及输入进程清理
    adapters/windows.cjs       PowerShell 启动与窗口枚举
  preload/index.cjs            沙箱中的最小 IPC 桥
  shared/                      不依赖 Electron、DOM 或 React
    score.mjs                  简谱解析、单旋律转换、键鼠事件编译
    score-session.mjs          每个实例的 MIDI 状态与统一编译入口
    simulation.mjs             共用模拟时钟，支持注入时间进行测试
  renderer/
    app/                       React 挂载和应用级配置
    platform/                  桌面桥与浏览器适配、统一结果解包
    features/studio/
      StudioPage.jsx           页面组合与弹窗开关
      components/              舞台、时间线、编辑器、设置、播放栏等
      hooks/                   useStudio / usePlayback / useOutputTarget
      data/                    练习谱、默认参数、显示标签
    shared/                    通用 UI 与动效参数
    styles/                    基础、布局、功能区与响应式样式
native/windows/                C# 输入引擎和 PowerShell 入口
scripts/                       包管理器约束
tests/                        测试（下列子目录位于tests/）
  unit/                        编译、MIDI 会话、模拟时序、依赖边界
  integration/                 Electron 实际窗口的完整操作回归
docs/                          架构与验证记录
build/renderer/                Vite 生成产物
dist/                          Electron 打包产物
```

样式以 JSX 中的 Tailwind 工具类为主，主题在 `src/renderer/styles/index.css` 定义；复杂选择器及响应式覆盖使用 `@apply`。`pnpm format` 同时自动排序工具类。

详细职责、依赖方向与扩展位置见 [架构说明](docs/architecture.md)。

`build/renderer/` 和 `dist/` 是生成产物；`pnpm-lock.yaml` 是唯一依赖锁文件。Electron 渲染进程启用沙箱与上下文隔离，禁止 Node 和外部导航，生产 CSP 禁止网络连接。

## 验证边界

已在 macOS 验证 React 构建、曲谱逻辑、Electron 导入/编辑/模拟播放/停止，以及浏览器模拟。详细结果见 [验证记录](docs/verification.md)。

**本次没有 Windows 游戏环境，未验证 SendInput 是否被游戏接收、实际音高及 Windows 打包。** 输入引擎保持独立，macOS 使用独立 Swift CGEvent 引擎；Windows SendInput、切窗保护和按键释放仍需要 Windows 实机验收。

### 曲谱列表与播放顺序

侧栏“我的曲谱”包含简谱和导入的 MIDI；标题固定，曲目列表独立滚动。曲库自动保存 MIDI 数据、简谱内容、名称、轨道和排列顺序；桌面端保存在用户数据目录的 library.json，浏览器保存在当前站点的 IndexedDB，两者独立。旧版未保存的导入曲目需要重新导入一次。点击侧栏或内容标题旁的铅笔即可改名，回车或失焦保存，Escape 取消。拖动曲目前的手柄可排序，也可以聚焦手柄后按 Alt + 上下方向键调整。底部进度条支持点击或拖动定位；试听会从新位置续播，键鼠演奏会先释放按键，再倒计时以便切回目标窗口。播放器右侧按钮依次切换顺序播放、列表循环、单曲循环和随机播放。只有正常播放结束才自动继续；点击主按钮或按停止快捷键会取消续播。

### macOS 原生输入

首次源码运行需安装 Xcode 或 Command Line Tools。`pnpm start` 和 `pnpm pack:mac` 自动构建 Swift 输入程序（Apple Silicon + Intel 通用二进制）；也可以单独运行 `pnpm native:mac`。打包后的用户不需要 Swift 或 Xcode。

授权入口只打开系统设置，权限由用户手动授予。无需录屏权限来枚举应用。使用英文键盘布局可避免输入法处理琴键。目标应用必须保持前台；开始有 5 秒切换时间，F8 / Fn+F8、⌘+Shift+S 和停止按钮均可停止。播放取消、焦点丢失、父进程退出和正常结束都会尝试释放已按下的输入。

`pnpm test:mac-input` 是显式的真实系统输入测试：打开本应用接收窗口，验证 8 个琴键、3 个鼠标键、演奏中停止和倒计时取消。测试会临时聚焦测试窗口并移动指针，请勿同时操作键鼠。普通 `pnpm test` 不发送系统输入。

## GitHub 自动打包与下载

正式下载见 [Releases](https://github.com/EchoXigua/melodica-player/releases)。Windows 提供 x64 免安装 EXE，Mac 分别提供 Apple Silicon 和 Intel DMG。Mac 目前是临时签名版本，尚未经过 Apple 公证。

- 手动构建：仓库 **Actions → Build and Release → Run workflow**，完成后从该次运行的 **Artifacts** 下载。手动构建不发布 Release。
- 正式发布：先更新 `package.json` 版本并提交、推送，再创建匹配的标签，例如 `git tag v0.2.0` 和 `git push origin v0.2.0`。三个平台全部成功后自动发布到 Releases，同时提供 SHA-256 校验文件。
- 流水线使用 GitHub 自带的临时令牌，不需要填写个人 Token。发布步骤单独申请 `contents: write`；构建步骤只有读取权限。
- 已发布的版本不会被覆盖。修复发布问题后使用新版本标签；尚未发布的草稿允许重新运行补齐文件。
- 本地 `pnpm pack:mac:dir` 仍可仅生成应用目录。CI 只运行逻辑测试，不在云端发送真实键鼠输入。
