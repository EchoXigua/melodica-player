# 代码架构

本项目保持单个 pnpm 包，不引入 monorepo。按运行环境分层，React 层按业务功能组织。

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
    styles/                    Tailwind 主题、全局基础及复杂状态覆盖
native/windows/                C# 输入引擎和 PowerShell 入口
scripts/                       包管理器约束
tests/                        测试（下列子目录位于tests/）
  unit/                        编译、MIDI 会话、模拟时序、依赖边界
  integration/                 Electron 实际窗口的完整操作回归
docs/                          架构与验证记录
build/renderer/                Vite 生成产物
dist/                          Electron 打包产物
```

## 依赖方向

React 组件通过 Hook 调用 `platform/client`。桌面端进入 preload → IPC → 主进程服务；浏览器进入 browser 适配器。两端共同调用 `shared` 的曲谱会话与模拟播放器。系统输入通过 main/adapters/input.cjs 按平台分派，Windows 使用 PowerShell/C# SendInput，macOS 使用 Swift CGEvent。两端复用 TSV 计划、倒计时/音符/停止事件和进程结束后确认释放的生命周期。

- `shared` 不引用 UI、Electron 或操作系统模块；编译器不保存 MIDI 状态。
- 渲染层不能直接引用 `main`、`preload`、`native` 或 Node API。边界由单元测试检查静态 import/require。
- preload 必须保持自包含：Electron 沙箱不支持任意本地模块 require。当前 `info / compile / midi / targets / play / stop` 请求与 `playback` 事件构成桥接协议；变更协议时同步修改 preload、IPC 和浏览器适配器。
- IPC 校验窗口与页面来源；统一返回 `{ ok, value }` 或 `{ ok: false, error }`。播放事件为 countdown、playing、note、done、stopped、error、idle。
- `useStudio` 管理编辑及编译请求顺序；`usePlayback` 管理事件订阅、计时器与播放取消；`useOutputTarget` 管理平台及目标窗口。
- 使用 Tailwind CSS 4 与官方 Vite 插件。组件布局、尺寸、间距、颜色优先写在 JSX 的 `className` 中，类名保持静态可扫描，动态状态选择完整类名。
- `styles/index.css` 定义 `@theme` 主题；`base.css` 保留原有全局 reset，避免 Preflight 改变原生输入控件和弹窗表现。
- 复杂后代选择器、控件伪元素及多条件响应式覆盖集中在对应 CSS 中，使用 `@apply`。这些覆盖不放入 utilities 层，明确高于组件基础类；`responsive.css` 最后导入，保持原有断点顺序。
- 新增样式优先使用常规 Tailwind 类与主题 token；精确桌面尺寸使用任意值。原有语义类名保留作状态、响应式与测试定位钩子。
- Prettier 的 Tailwind 插件会自动排序 JSX 工具类，运行 `pnpm format` 即可。

## 常见修改的位置

增加简谱语法或调整键位：`shared/score.mjs`，并补充编译测试。
增加编辑器能力：`features/studio/components/ScoreEditor.jsx` 与 `hooks/useStudio.js`。
修改播放状态显示：`hooks/usePlayback.js`、`components/Performance.jsx`、`components/Player.jsx`。
修改 Windows 输入协议：`main/services/playback.cjs` 与 `native/windows/`，必须在 Windows 实机验证。
新增另一套桌面能力：在 main 中实现适配器，经过 IPC/preload 暴露，勿直接导入 React。

## 验证

`pnpm test` 检查共享逻辑与依赖方向；`pnpm test:electron` 构建并验证真实 Electron 窗口中的编辑、导入、模拟播放、停止、弹窗与小窗口布局；`pnpm format:check` 检查格式。

## 试听、紧急停止与接收测试

- `renderer/shared/audio/synth.mjs`：由点击操作解锁 AudioContext，根据编译后的 pitch/at/hold 前瞻调度振荡器，停止时销毁所有已调度声音。游戏输出不创建试听声音。
- `shared/shortcuts.mjs` + `main/services/shortcuts.cjs`：统一快捷键识别、注册与状态提示；媒体播放键不当作 F8。
- `usePlayback` 以同步 ref 处理准备阶段取消和动画终止，`stop-requested` 在不存在后端任务时也会通知前端取消准备。`stop-error` 保留锁定并提示失败。
- `main/services/playback.cjs`：原生终态直到子进程 close 后才确认，释放错误优先于 STOP/DONE；取消准备会直接阻止子进程启动。
- `main/services/input-test.cjs`：创建沙箱接收窗口；只允许该窗口提交接收记录与启动固定测试曲。普通 compile/play 等 IPC 不向接收窗口开放。
- `features/input-test/InputTestPage.jsx`：记录接收区域的乐器按键及鼠标事件，标注 isTrusted；实际发送由对应平台原生引擎执行。
- `shared/input-test.mjs`：固定测试计划和有序收发比对。可信事件不能独自区分人工和程序输入，因此自动测试时不得混入人工事件。

自动化集成测试中的 sendInputEvent 和 KeyboardEvent 仅用于验证 UI、快捷键、事件可信度处理，不能替代 Windows SendInput 的实机验证。

- `native/macos/InputEngine.swift`：CGEvent 输出、前台应用检查、F8/停止文件/父进程存活检查和退出释放。
- `scripts/build-mac-input.cjs`：编译并合并 arm64 / x86_64 二进制；macOS 打包复制到 Resources/native/macos。
- `main/adapters/macos.cjs`：应用枚举、辅助功能权限状态与设置入口，渲染进程不能执行任意命令。
- `tests/integration/mac-input-smoke.cjs`：显式运行的原生接收测试；与 UI 脚本事件测试分开。
