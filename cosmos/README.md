# COSMOS · 宇宙尺度之旅 (A Journey of Cosmic Scales)

一个纯静态、零构建、零运行时 CDN 依赖的交互式 3D 宇宙可视化应用。
三个场景共享同一外壳（导航、画质管理、设计系统），通过哈希路由切换：

| 路由 | 场景 | 内容 |
|---|---|---|
| `#/blackhole` | SINGULARITY 黑洞 | 活动吸积盘、屏幕空间引力透镜、相对论喷流（移植自 PlayCanvas 版） |
| `#/galaxy` | GALACTIC ATLAS 银河系 | 15 万粒子棒旋星系、POI 巡航、UnrealBloom 后处理 |
| `#/solar` | HELIO 太阳系 | 八大行星、时间加速、相机预设、小行星带 |

## 特性

- **统一引擎**：三个场景全部运行在本地化 three.js r160（ESM + importmap），无任何运行时网络请求（纹理全部程序化生成或本地资源）。
- **统一外壳**：顶部导航、加载屏、FPS 计数、双语（中/英）界面。
- **尺度穿梭（Scale Warp）**：场景间导航走"星流隧道"过渡动画（目标场景模块在动画期间预加载）。银河场景中人马座 A* 和迷你太阳系是**可点击热点**，POI 信息面板带"进入"按钮，直达黑洞/太阳系场景——导航闭环。
- **开场总览**：首次加载展示尺度线动画（黑洞 10⁻⁴ pc → 银河系 30 kpc → 太阳系 45 亿 km），场景就绪后自动进入，点击可跳过。
- **程序化音效**：WebAudio 合成的太空氛围底噪 + UI 音效 + 穿梭呼啸声，顶栏可静音（记忆设置），零音频资源文件。
- **画质档位**：自动 / 高 / 中 / 低 / 极简（potato）。自动模式按 FPS 升降档（像素比 + 粒子密度 + Bloom 分辨率联动），移动端自动从低档起步。
- **可分享 URL**：相机位置与场景状态编码进哈希（`#/galaxy?s=…`），打开链接即恢复视角。
- **稳健性**：切后台自动暂停渲染、WebGL 上下文丢失给出刷新提示。
- **可测试**：Playwright 无头冒烟 + 截图，机器可读契约（`body[data-ready]` / `window.__errors`）。

## 运行

**注意**：必须通过 HTTP 访问（ES module + importmap 不支持 `file://`，
直接双击 `index.html` 会被浏览器 CORS 策略拦截）。

- **Windows 一键启动**：双击 `启动-COSMOS.bat`（自动起本地服务器并打开浏览器）。
- 或手动用任意静态服务器：

```bash
python -m http.server 8801 --directory cosmos
# 打开 http://127.0.0.1:8801/
```

## 测试

```bash
node cosmos/tests/smoke.js 8801            # 集成冒烟：三场景加载 + 切换 + 重进
node cosmos/tests/url-state.js 8801        # URL 状态持久化/恢复回归
node cosmos/tests/shot.js solar out.png    # 单场景截图（route outfile [waitMs] [evalJs] [port]）
```

测试依赖全局 omniroute 安装中的 Playwright（沿用 `kimi-blackhole/shot.js` 的路径约定）。

## 目录结构

```
cosmos/
  index.html              # 外壳：importmap、设计系统 CSS、导航、加载/错误层
  src/
    main.js               # 哈希路由 + 场景管理器 + 错误/就绪契约
    core/stage.js         # 共享 WebGLRenderer、动画循环、resize、FPS
    core/quality.js       # 画质档位与自动调节
    ui/hud.js             # 顶栏交互
    scenes/CONTRACT.md    # 场景模块接口契约（新场景必读）
    scenes/solar/         # 太阳系场景
    scenes/galaxy/        # 银河系场景
    scenes/blackhole/     # 黑洞场景（PlayCanvas → Three.js 移植）
  vendor/three/           # three.js r160 + addons（本地化，勿删）
  tests/                  # Playwright 冒烟/截图/URL 状态测试
```

## 部署

纯静态站点，无服务端：把 `cosmos/` 整个目录拷到任意静态托管（GitHub Pages、
Netlify、Nginx…）即可。建议为 `src/` 下的 JS 配置较短的缓存时间或带 hash
的文件名策略（`vendor/` 可长缓存）。

## 新增一个场景

1. 读 `src/scenes/CONTRACT.md`。
2. 在 `src/scenes/<id>/index.js` 实现 `createScene(ctx)`。
3. 在 `src/main.js` 的 `ROUTES` 与 `index.html` 的 `#nav` 各加一项。
4. 在 `tests/smoke.js` 的 `ROUTES` 数组加入新 id。

## 资源说明 · Assets

- `assets/planets/` 下的地球与月球贴图（`earth_atmos_2048.jpg`、
  `earth_clouds_1024.png`、`earth_specular_2048.jpg`、`moon_1024.jpg`）来自
  three.js 官方 examples（r160），MIT License，已本地化随站点分发；加载失败时
  太阳系场景自动回退到程序化贴图。
- 其余所有天体贴图（太阳、八大行星中除地球外、土星环、星空等）均为
  `src/scenes/*/textures.js` 在运行时用 Canvas 程序化生成，无外部依赖。
