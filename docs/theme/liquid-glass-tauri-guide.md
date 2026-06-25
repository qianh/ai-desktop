# Tauri 苹果液态玻璃风格主题开发指南

> 适用范围：Tauri v2 桌面应用、React / Vue / Svelte / Solid 等前端框架、macOS / Windows / Linux 跨平台桌面应用。  
> 目标：实现一套受 Apple Liquid Glass 启发的主题系统，包括透明窗口、系统材质、玻璃组件、动态高光、动效、可访问性降级和性能优化。

---

## 目录

1. [设计目标](#1-设计目标)
2. [技术路线](#2-技术路线)
3. [兼容性策略](#3-兼容性策略)
4. [项目结构建议](#4-项目结构建议)
5. [Tauri 窗口配置](#5-tauri-窗口配置)
6. [前端基础样式](#6-前端基础样式)
7. [主题 Token 设计](#7-主题-token-设计)
8. [核心玻璃材质类](#8-核心玻璃材质类)
9. [液态动态高光](#9-液态动态高光)
10. [窗口标题栏与拖拽区域](#10-窗口标题栏与拖拽区域)
11. [核心组件实现](#11-核心组件实现)
12. [页面布局示例](#12-页面布局示例)
13. [主题切换与持久化](#13-主题切换与持久化)
14. [可访问性与降级](#14-可访问性与降级)
15. [性能优化](#15-性能优化)
16. [跨平台差异处理](#16-跨平台差异处理)
17. [测试清单](#17-测试清单)
18. [常见问题](#18-常见问题)
19. [发布前检查清单](#19-发布前检查清单)

---

## 1. 设计目标

这套主题不是简单的 `blur + opacity`，而是要让应用形成接近 Apple Liquid Glass 的层级感、柔和反射和流动反馈。

核心目标：

- 背景可以透出系统材质或应用背景。
- UI 控件具有半透明、模糊、边缘高光和内阴影。
- 鼠标移动时，玻璃表面有轻微光斑跟随。
- 深色模式和浅色模式都保持足够对比度。
- 在不支持系统材质的平台上自动降级。
- 在低性能设备、减少动态效果、减少透明度场景中可读性优先。

视觉关键词：

- 半透明
- 模糊
- 饱和度提升
- 边缘折射感
- 柔和阴影
- 悬浮层级
- 动态高光
- 可读性优先

---

## 2. 技术路线

建议把主题拆成三层实现。

### 2.1 原生窗口层

由 Tauri 负责：

- 透明窗口
- 无边框窗口
- 自定义标题栏
- macOS vibrancy / semantic material
- Windows Mica / Acrylic
- 窗口阴影

这层负责让整个应用窗口具备系统级材质基础。

### 2.2 Web 材质层

由 CSS 负责：

- `backdrop-filter: blur(...) saturate(...)`
- 半透明背景色
- 渐变边框
- 内阴影
- 外阴影
- 深浅主题变量

这层负责卡片、侧边栏、按钮、弹窗、菜单等组件。

### 2.3 动态交互层

由 TypeScript / JavaScript 负责：

- 鼠标坐标写入 CSS 变量
- hover / active 动效
- 减少动态效果时禁用动画
- 可选 SVG displacement 模拟折射
- 可选根据窗口聚焦状态调整透明度

这层负责“液态”和“活着”的感觉。

---

## 3. 兼容性策略

| 平台 | 推荐实现 | 说明 |
|---|---|---|
| macOS | Tauri `windowEffects` + CSS glass | 效果最佳，可使用 semantic material |
| Windows 11 | Mica + CSS glass | 推荐主窗口使用 Mica，浮层用 CSS glass |
| Windows 10 | Acrylic + CSS glass | Acrylic 可能更吃性能，谨慎使用 |
| Linux | CSS glass 降级 | 没有统一系统材质，依赖 Web 层 |
| 低性能设备 | solid 模式 | 减少透明、减少 blur、减少动画 |

建议提供三档主题强度：

```ts
export type GlassIntensity = "solid" | "soft" | "liquid";
```

- `solid`：低透明、低模糊，强调可读性。
- `soft`：中等透明和模糊，默认推荐。
- `liquid`：更强玻璃感和动态效果，适合展示型界面。

---

## 4. 项目结构建议

```txt
src/
  app/
    App.tsx
    main.tsx
  theme/
    glass.css
    tokens.css
    accessibility.css
    motion.css
    platform.css
    theme-manager.ts
  components/
    GlassButton.tsx
    GlassCard.tsx
    GlassSidebar.tsx
    GlassInput.tsx
    GlassModal.tsx
    GlassSwitch.tsx
    GlassSegmented.tsx
  hooks/
    useLiquidPointer.ts
    useThemeMode.ts
  layouts/
    AppShell.tsx
src-tauri/
  tauri.conf.json
  tauri.macos.conf.json
  tauri.windows.conf.json
  tauri.linux.conf.json
```

如果不是 React 项目，可以保留 `theme/` 的 CSS 和 TS 工具函数，然后按你的框架封装组件。

---

## 5. Tauri 窗口配置

### 5.1 基础配置

`src-tauri/tauri.conf.json`

```json
{
  "productName": "GlassApp",
  "version": "0.1.0",
  "identifier": "com.example.glassapp",
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "GlassApp",
        "width": 1180,
        "height": 760,
        "minWidth": 860,
        "minHeight": 560,
        "transparent": true,
        "decorations": false,
        "shadow": true,
        "resizable": true,
        "center": true
      }
    ]
  }
}
```

关键点：

- `transparent: true`：允许窗口透明。
- `decorations: false`：关闭系统标题栏，方便自定义标题栏。
- `shadow: true`：保留窗口阴影。
- `resizable: true`：允许缩放窗口。

### 5.2 macOS 配置

`src-tauri/tauri.macos.conf.json`

```json
{
  "app": {
    "macOSPrivateApi": true,
    "windows": [
      {
        "label": "main",
        "titleBarStyle": "Overlay",
        "hiddenTitle": true,
        "trafficLightPosition": {
          "x": 18,
          "y": 18
        },
        "windowEffects": {
          "effects": ["sidebar"],
          "state": "active",
          "radius": 18
        }
      }
    ]
  }
}
```

说明：

- macOS 透明窗口通常需要开启 `macOSPrivateApi`。
- 如果你要上架 Mac App Store，需要特别注意私有 API 的风险。
- `titleBarStyle: "Overlay"` 适合做自定义标题栏。
- `trafficLightPosition` 用于调整 macOS 红黄绿按钮位置。
- `windowEffects.effects` 可以根据窗口用途尝试 `sidebar`、`hudWindow`、`contentBackground` 等语义效果。

### 5.3 Windows 配置

`src-tauri/tauri.windows.conf.json`

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "windowEffects": {
          "effects": ["mica"]
        }
      }
    ]
  }
}
```

建议：

- Windows 11 主窗口优先用 `mica`。
- Windows 10 / 11 浮层可以尝试 `acrylic`。
- 如果出现拖拽、缩放卡顿，减少 CSS blur 面积，或者改用 `solid` 模式。

### 5.4 Linux 配置

`src-tauri/tauri.linux.conf.json`

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "transparent": false,
        "decorations": false,
        "shadow": true
      }
    ]
  }
}
```

Linux 上不同桌面环境差异较大。建议不要依赖系统级窗口材质，而是在 Web 层使用半透明卡片和背景图/渐变实现类似效果。

---

## 6. 前端基础样式

`src/theme/base.css`

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  background: transparent;
  overflow: hidden;
}

* {
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "SF Pro Display",
    "SF Pro Text",
    "Segoe UI",
    system-ui,
    sans-serif;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  border: 0;
}
```

重点：

- `html/body/#root` 必须透明，否则会盖住 Tauri 的窗口材质。
- 不要给 `body` 设置实色背景。
- 真正的背景应该放在应用容器内部，方便做平台降级。

---

## 7. 主题 Token 设计

`src/theme/tokens.css`

```css
:root {
  color-scheme: light dark;

  --app-radius-sm: 10px;
  --app-radius-md: 16px;
  --app-radius-lg: 22px;
  --app-radius-xl: 30px;
  --app-radius-pill: 999px;

  --glass-blur: 26px;
  --glass-saturate: 1.65;
  --glass-brightness: 1.04;

  --glass-bg: rgba(255, 255, 255, 0.34);
  --glass-bg-hover: rgba(255, 255, 255, 0.46);
  --glass-bg-active: rgba(255, 255, 255, 0.58);
  --glass-bg-strong: rgba(255, 255, 255, 0.68);

  --glass-border: rgba(255, 255, 255, 0.46);
  --glass-border-strong: rgba(255, 255, 255, 0.72);
  --glass-highlight: rgba(255, 255, 255, 0.86);
  --glass-shadow: rgba(0, 0, 0, 0.18);

  --surface-base: rgba(246, 247, 250, 0.72);
  --surface-elevated: rgba(255, 255, 255, 0.48);

  --text-primary: rgba(17, 20, 28, 0.94);
  --text-secondary: rgba(17, 20, 28, 0.64);
  --text-tertiary: rgba(17, 20, 28, 0.42);

  --accent: rgb(0, 113, 227);
  --accent-soft: rgba(0, 113, 227, 0.18);
  --danger: rgb(255, 59, 48);
  --success: rgb(52, 199, 89);
  --warning: rgb(255, 149, 0);

  --duration-fast: 140ms;
  --duration-normal: 240ms;
  --duration-slow: 420ms;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.2, 0.8, 0.2, 1);
}

[data-theme="dark"] {
  --glass-bg: rgba(24, 26, 34, 0.46);
  --glass-bg-hover: rgba(34, 37, 48, 0.58);
  --glass-bg-active: rgba(44, 48, 62, 0.7);
  --glass-bg-strong: rgba(38, 42, 54, 0.78);

  --glass-border: rgba(255, 255, 255, 0.13);
  --glass-border-strong: rgba(255, 255, 255, 0.24);
  --glass-highlight: rgba(255, 255, 255, 0.28);
  --glass-shadow: rgba(0, 0, 0, 0.46);

  --surface-base: rgba(15, 17, 22, 0.74);
  --surface-elevated: rgba(28, 30, 38, 0.58);

  --text-primary: rgba(255, 255, 255, 0.94);
  --text-secondary: rgba(255, 255, 255, 0.66);
  --text-tertiary: rgba(255, 255, 255, 0.42);

  --accent: rgb(10, 132, 255);
  --accent-soft: rgba(10, 132, 255, 0.2);
}
```

### 7.1 主题强度

`src/theme/platform.css`

```css
[data-glass="solid"] {
  --glass-blur: 0px;
  --glass-saturate: 1;
  --glass-brightness: 1;
  --glass-bg: rgba(255, 255, 255, 0.92);
  --glass-bg-hover: rgba(255, 255, 255, 0.96);
  --glass-bg-active: rgba(255, 255, 255, 0.98);
}

[data-theme="dark"][data-glass="solid"] {
  --glass-bg: rgba(22, 24, 30, 0.94);
  --glass-bg-hover: rgba(28, 31, 40, 0.98);
  --glass-bg-active: rgba(32, 36, 46, 1);
}

[data-glass="soft"] {
  --glass-blur: 18px;
  --glass-saturate: 1.35;
  --glass-brightness: 1.02;
}

[data-glass="liquid"] {
  --glass-blur: 30px;
  --glass-saturate: 1.75;
  --glass-brightness: 1.06;
}
```

---

## 8. 核心玻璃材质类

`src/theme/glass.css`

```css
.liquid-glass {
  position: relative;
  isolation: isolate;
  border-radius: var(--glass-radius, var(--app-radius-lg));
  background:
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.44) 0%,
      rgba(255, 255, 255, 0.18) 34%,
      rgba(255, 255, 255, 0.06) 100%
    ),
    var(--glass-bg);

  border: 1px solid var(--glass-border);

  backdrop-filter:
    blur(var(--glass-blur))
    saturate(var(--glass-saturate))
    brightness(var(--glass-brightness));
  -webkit-backdrop-filter:
    blur(var(--glass-blur))
    saturate(var(--glass-saturate))
    brightness(var(--glass-brightness));

  box-shadow:
    0 18px 56px var(--glass-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.42),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);

  overflow: hidden;
  transform: translateZ(0);
}

.liquid-glass::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  pointer-events: none;
  background:
    radial-gradient(
      circle at var(--mx, 50%) var(--my, 0%),
      var(--glass-highlight),
      transparent 34%
    );
  opacity: var(--glass-highlight-opacity, 0.42);
  mix-blend-mode: screen;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.liquid-glass::after {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: calc(var(--glass-radius, var(--app-radius-lg)) - 1px);
  pointer-events: none;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.28),
      transparent 38%,
      rgba(255, 255, 255, 0.06)
    );
  opacity: 0.72;
}

.liquid-glass:hover {
  background:
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.54) 0%,
      rgba(255, 255, 255, 0.2) 38%,
      rgba(255, 255, 255, 0.08) 100%
    ),
    var(--glass-bg-hover);
  border-color: var(--glass-border-strong);
}

.liquid-glass[data-depth="1"] {
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.34);
}

.liquid-glass[data-depth="2"] {
  box-shadow:
    0 18px 56px var(--glass-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.42),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);
}

.liquid-glass[data-depth="3"] {
  box-shadow:
    0 28px 80px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.52),
    inset 0 -1px 0 rgba(255, 255, 255, 0.12);
}
```

使用：

```html
<div class="liquid-glass" data-depth="2">
  内容
</div>
```

---

## 9. 液态动态高光

### 9.1 原生 TypeScript 实现

`src/hooks/useLiquidPointer.ts`

```ts
export function bindLiquidPointer(root: ParentNode = document) {
  const elements = root.querySelectorAll<HTMLElement>(".liquid-glass");

  const cleanups: Array<() => void> = [];

  elements.forEach((el) => {
    const onPointerMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
      el.style.setProperty("--glass-highlight-opacity", "0.56");
    };

    const onPointerLeave = () => {
      el.style.setProperty("--mx", "50%");
      el.style.setProperty("--my", "0%");
      el.style.setProperty("--glass-highlight-opacity", "0.34");
    };

    el.addEventListener("pointermove", onPointerMove, { passive: true });
    el.addEventListener("pointerleave", onPointerLeave, { passive: true });

    cleanups.push(() => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}
```

入口调用：

```ts
import { bindLiquidPointer } from "./hooks/useLiquidPointer";

bindLiquidPointer();
```

### 9.2 React Hook 版本

```tsx
import { useEffect, useRef } from "react";

export function useLiquidPointer<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPointerMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
      el.style.setProperty("--glass-highlight-opacity", "0.56");
    };

    const onPointerLeave = () => {
      el.style.setProperty("--mx", "50%");
      el.style.setProperty("--my", "0%");
      el.style.setProperty("--glass-highlight-opacity", "0.34");
    };

    el.addEventListener("pointermove", onPointerMove, { passive: true });
    el.addEventListener("pointerleave", onPointerLeave, { passive: true });

    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return ref;
}
```

---

## 10. 窗口标题栏与拖拽区域

关闭系统标题栏后，需要自己实现可拖拽区域。

```css
.app-titlebar {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  user-select: none;
}

.app-titlebar--mac {
  padding-left: 78px;
}

.app-titlebar__title {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-secondary);
}

.app-titlebar__spacer {
  flex: 1;
}
```

React 示例：

```tsx
export function AppTitlebar() {
  return (
    <header className="app-titlebar app-titlebar--mac" data-tauri-drag-region>
      <span className="app-titlebar__title">GlassApp</span>
      <div className="app-titlebar__spacer" data-tauri-drag-region />
    </header>
  );
}
```

注意：

- 只有添加 `data-tauri-drag-region` 的区域才能拖动窗口。
- 按钮、输入框、菜单不应该放在拖拽区域里，或者需要阻止拖拽干扰。
- macOS 要给红黄绿按钮留出左侧空间。

---

## 11. 核心组件实现

### 11.1 GlassButton

`src/components/GlassButton.tsx`

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useLiquidPointer } from "../hooks/useLiquidPointer";
import "./GlassButton.css";

type GlassButtonVariant = "default" | "primary" | "danger";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: GlassButtonVariant;
  children: ReactNode;
};

export function GlassButton({
  variant = "default",
  className = "",
  children,
  ...props
}: GlassButtonProps) {
  const ref = useLiquidPointer<HTMLButtonElement>();

  return (
    <button
      ref={ref}
      className={`liquid-glass glass-button glass-button--${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

`src/components/GlassButton.css`

```css
.glass-button {
  --glass-radius: var(--app-radius-pill);

  min-height: 38px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  color: var(--text-primary);
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.01em;

  cursor: pointer;
  user-select: none;

  transition:
    transform var(--duration-fast) var(--ease-spring),
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.glass-button:hover {
  transform: translateY(-1px) scale(1.012);
}

.glass-button:active {
  transform: translateY(0) scale(0.982);
}

.glass-button:disabled {
  cursor: not-allowed;
  opacity: 0.46;
  transform: none;
}

.glass-button--primary {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.1)),
    color-mix(in srgb, var(--accent) 26%, transparent);
  border-color: color-mix(in srgb, var(--accent) 44%, white 20%);
}

.glass-button--danger {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.08)),
    color-mix(in srgb, var(--danger) 22%, transparent);
  border-color: color-mix(in srgb, var(--danger) 44%, white 18%);
}
```

### 11.2 GlassCard

```tsx
import type { HTMLAttributes, ReactNode } from "react";
import { useLiquidPointer } from "../hooks/useLiquidPointer";
import "./GlassCard.css";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  depth?: 1 | 2 | 3;
  children: ReactNode;
};

export function GlassCard({
  depth = 2,
  className = "",
  children,
  ...props
}: GlassCardProps) {
  const ref = useLiquidPointer<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`liquid-glass glass-card ${className}`}
      data-depth={depth}
      {...props}
    >
      {children}
    </div>
  );
}
```

```css
.glass-card {
  padding: 18px;
  color: var(--text-primary);
}

.glass-card h1,
.glass-card h2,
.glass-card h3 {
  margin: 0 0 10px;
  letter-spacing: -0.03em;
}

.glass-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.65;
}
```

### 11.3 GlassInput

```tsx
import type { InputHTMLAttributes } from "react";
import "./GlassInput.css";

type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function GlassInput({ label, className = "", ...props }: GlassInputProps) {
  return (
    <label className={`glass-field ${className}`}>
      {label && <span className="glass-field__label">{label}</span>}
      <input className="liquid-glass glass-input" {...props} />
    </label>
  );
}
```

```css
.glass-field {
  display: grid;
  gap: 8px;
}

.glass-field__label {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-secondary);
}

.glass-input {
  --glass-radius: var(--app-radius-md);

  width: 100%;
  height: 42px;
  padding: 0 13px;
  outline: none;
  color: var(--text-primary);
  background: var(--glass-bg);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}

.glass-input::placeholder {
  color: var(--text-tertiary);
}

.glass-input:focus {
  border-color: color-mix(in srgb, var(--accent) 58%, white 18%);
  box-shadow:
    0 0 0 3px var(--accent-soft),
    0 14px 38px var(--glass-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
```

### 11.4 GlassSidebar

```tsx
import type { ReactNode } from "react";
import "./GlassSidebar.css";

export function GlassSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="liquid-glass glass-sidebar" data-depth="2">
      {children}
    </aside>
  );
}
```

```css
.glass-sidebar {
  --glass-radius: var(--app-radius-xl);

  min-width: 240px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.glass-sidebar__section-title {
  margin: 14px 10px 6px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.glass-sidebar__item {
  height: 38px;
  padding: 0 12px;
  border-radius: var(--app-radius-md);
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-spring);
}

.glass-sidebar__item:hover {
  background: rgba(255, 255, 255, 0.18);
  color: var(--text-primary);
}

.glass-sidebar__item[aria-current="page"] {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.34);
}
```

### 11.5 GlassModal

```tsx
import type { ReactNode } from "react";
import "./GlassModal.css";

type GlassModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function GlassModal({ open, title, children, onClose }: GlassModalProps) {
  if (!open) return null;

  return (
    <div className="glass-modal-root" role="presentation">
      <div className="glass-modal-backdrop" onClick={onClose} />
      <section className="liquid-glass glass-modal" role="dialog" aria-modal="true" aria-label={title} data-depth="3">
        <header className="glass-modal__header">
          <h2>{title}</h2>
          <button className="glass-modal__close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="glass-modal__body">{children}</div>
      </section>
    </div>
  );
}
```

```css
.glass-modal-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
}

.glass-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.glass-modal {
  --glass-radius: 28px;

  position: relative;
  width: min(520px, calc(100vw - 32px));
  padding: 18px;
  animation: glass-modal-in var(--duration-normal) var(--ease-out);
}

.glass-modal__header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.glass-modal__header h2 {
  flex: 1;
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.03em;
}

.glass-modal__close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: var(--text-secondary);
  cursor: pointer;
}

.glass-modal__body {
  margin-top: 14px;
  color: var(--text-secondary);
}

@keyframes glass-modal-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.975);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

### 11.6 GlassSwitch

```tsx
import "./GlassSwitch.css";

type GlassSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function GlassSwitch({ checked, onChange, label }: GlassSwitchProps) {
  return (
    <label className="glass-switch">
      <span className="glass-switch__label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className="liquid-glass glass-switch__control"
        data-checked={checked ? "true" : "false"}
        onClick={() => onChange(!checked)}
      >
        <span className="glass-switch__thumb" />
      </button>
    </label>
  );
}
```

```css
.glass-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.glass-switch__label {
  color: var(--text-secondary);
  font-size: 14px;
}

.glass-switch__control {
  --glass-radius: var(--app-radius-pill);

  width: 52px;
  height: 32px;
  padding: 3px;
  display: flex;
  align-items: center;
  cursor: pointer;
  background: var(--glass-bg);
}

.glass-switch__control[data-checked="true"] {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.36), rgba(255, 255, 255, 0.08)),
    var(--accent);
}

.glass-switch__thumb {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
  transform: translateX(0);
  transition: transform var(--duration-normal) var(--ease-spring);
}

.glass-switch__control[data-checked="true"] .glass-switch__thumb {
  transform: translateX(20px);
}
```

---

## 12. 页面布局示例

`src/layouts/AppShell.tsx`

```tsx
import { GlassButton } from "../components/GlassButton";
import { GlassCard } from "../components/GlassCard";
import { GlassInput } from "../components/GlassInput";
import { GlassSidebar } from "../components/GlassSidebar";
import "./AppShell.css";

export function AppShell() {
  return (
    <main className="app-shell">
      <div className="app-bg" />

      <div className="app-window">
        <GlassSidebar>
          <div className="app-titlebar app-titlebar--mac" data-tauri-drag-region>
            <span className="app-titlebar__title">GlassApp</span>
          </div>

          <div className="glass-sidebar__section-title">Main</div>
          <div className="glass-sidebar__item" aria-current="page">Dashboard</div>
          <div className="glass-sidebar__item">Projects</div>
          <div className="glass-sidebar__item">Settings</div>
        </GlassSidebar>

        <section className="app-content">
          <header className="app-content__header liquid-glass" data-depth="1" data-tauri-drag-region>
            <div>
              <h1>Dashboard</h1>
              <p>Liquid glass theme for Tauri apps.</p>
            </div>
            <GlassButton variant="primary">新建项目</GlassButton>
          </header>

          <div className="app-grid">
            <GlassCard>
              <h2>玻璃卡片</h2>
              <p>使用半透明背景、backdrop-filter、边缘高光和动态鼠标光斑。</p>
            </GlassCard>

            <GlassCard>
              <h2>输入区域</h2>
              <GlassInput label="项目名称" placeholder="输入名称" />
            </GlassCard>
          </div>
        </section>
      </div>
    </main>
  );
}
```

`src/layouts/AppShell.css`

```css
.app-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  padding: 14px;
  color: var(--text-primary);
  overflow: hidden;
}

.app-bg {
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(circle at 16% 18%, rgba(0, 113, 227, 0.24), transparent 28%),
    radial-gradient(circle at 84% 20%, rgba(191, 90, 242, 0.2), transparent 30%),
    radial-gradient(circle at 50% 90%, rgba(52, 199, 89, 0.16), transparent 34%),
    var(--surface-base);
}

.app-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(circle at center, black, transparent 72%);
  opacity: 0.38;
}

.app-window {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 14px;
}

.app-content {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 14px;
}

.app-content__header {
  --glass-radius: var(--app-radius-xl);

  min-height: 86px;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.app-content__header h1 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.04em;
}

.app-content__header p {
  margin: 4px 0 0;
  color: var(--text-secondary);
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-content: start;
}

@media (max-width: 900px) {
  .app-window {
    grid-template-columns: 1fr;
  }

  .glass-sidebar {
    display: none;
  }

  .app-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 13. 主题切换与持久化

### 13.1 Theme Manager

`src/theme/theme-manager.ts`

```ts
export type ThemeMode = "light" | "dark" | "system";
export type GlassMode = "solid" | "soft" | "liquid";

const THEME_KEY = "app.theme";
const GLASS_KEY = "app.glass";

export function getStoredTheme(): ThemeMode {
  return (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? "system";
}

export function getStoredGlassMode(): GlassMode {
  return (localStorage.getItem(GLASS_KEY) as GlassMode | null) ?? "soft";
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return mode;
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = mode;
  localStorage.setItem(THEME_KEY, mode);
}

export function applyGlassMode(mode: GlassMode) {
  document.documentElement.dataset.glass = mode;
  localStorage.setItem(GLASS_KEY, mode);
}

export function initializeTheme() {
  const theme = getStoredTheme();
  const glass = getStoredGlassMode();

  applyTheme(theme);
  applyGlassMode(glass);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getStoredTheme() === "system") {
      applyTheme("system");
    }
  });
}
```

入口：

```ts
import { initializeTheme } from "./theme/theme-manager";
import "./theme/tokens.css";
import "./theme/base.css";
import "./theme/glass.css";
import "./theme/platform.css";
import "./theme/accessibility.css";

initializeTheme();
```

### 13.2 设置页示例

```tsx
import { applyGlassMode, applyTheme, type GlassMode, type ThemeMode } from "../theme/theme-manager";

export function AppearanceSettings() {
  return (
    <div className="settings-group">
      <label>
        主题
        <select onChange={(event) => applyTheme(event.target.value as ThemeMode)}>
          <option value="system">跟随系统</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </label>

      <label>
        玻璃强度
        <select onChange={(event) => applyGlassMode(event.target.value as GlassMode)}>
          <option value="solid">实色</option>
          <option value="soft">柔和</option>
          <option value="liquid">液态</option>
        </select>
      </label>
    </div>
  );
}
```

---

## 14. 可访问性与降级

`src/theme/accessibility.css`

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }

  .glass-button:hover,
  .glass-button:active {
    transform: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  :root {
    --glass-blur: 0px;
    --glass-saturate: 1;
    --glass-brightness: 1;
    --glass-bg: rgba(255, 255, 255, 0.94);
    --glass-bg-hover: rgba(255, 255, 255, 0.98);
    --glass-border: rgba(0, 0, 0, 0.12);
  }

  [data-theme="dark"] {
    --glass-bg: rgba(24, 26, 34, 0.96);
    --glass-bg-hover: rgba(30, 34, 44, 0.98);
    --glass-border: rgba(255, 255, 255, 0.14);
  }
}

@media (prefers-contrast: more) {
  :root {
    --text-primary: rgba(0, 0, 0, 1);
    --text-secondary: rgba(0, 0, 0, 0.78);
    --glass-bg: rgba(255, 255, 255, 0.88);
    --glass-border: rgba(0, 0, 0, 0.22);
  }

  [data-theme="dark"] {
    --text-primary: rgba(255, 255, 255, 1);
    --text-secondary: rgba(255, 255, 255, 0.82);
    --glass-bg: rgba(20, 22, 28, 0.92);
    --glass-border: rgba(255, 255, 255, 0.26);
  }
}

:focus-visible {
  outline: 3px solid var(--accent-soft);
  outline-offset: 2px;
}
```

可访问性原则：

- 正文不要直接放在高度透明的背景上。
- 弹窗、表单、菜单建议使用 `--glass-bg-strong`。
- 小字号文字避免放在复杂背景上。
- 提供 `solid` 模式给低视力用户。
- 支持 `prefers-reduced-motion`。
- 支持 `prefers-reduced-transparency`，但不要只依赖它。

---

## 15. 性能优化

`backdrop-filter` 的成本主要来自模糊区域大小、层叠数量和动画频率。

### 15.1 优先级规则

推荐：

- 侧边栏、标题栏、卡片、小弹窗使用 blur。
- 主内容区域少用大面积 blur。
- 背景复杂时减少透明度。
- 动画只改 `transform` 和 `opacity`。
- 鼠标移动只更新 CSS 变量，不触发 React state。

避免：

- 给整个 `body` 做 `backdrop-filter`。
- 对大面积滚动容器做高半径 blur。
- 在 `pointermove` 中调用 React `setState`。
- 同时叠加多个大面积透明层。
- 在 blur 元素上频繁改变尺寸。

### 15.2 移动端或低性能降级

虽然 Tauri 主要面向桌面，但部分设备 WebView 性能有限，可以加简单策略：

```ts
export function autoDowngradeGlass() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const lowMemory = typeof memory === "number" && memory <= 4;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (lowMemory || reducedMotion) {
    document.documentElement.dataset.glass = "solid";
  }
}
```

入口调用：

```ts
autoDowngradeGlass();
```

### 15.3 动态高光节流版本

如果组件很多，可以给 `pointermove` 加 `requestAnimationFrame`。

```ts
export function bindLiquidPointerWithRaf(root: ParentNode = document) {
  const elements = root.querySelectorAll<HTMLElement>(".liquid-glass");
  const cleanups: Array<() => void> = [];

  elements.forEach((el) => {
    let frame = 0;
    let lastEvent: PointerEvent | null = null;

    const update = () => {
      frame = 0;
      if (!lastEvent) return;

      const rect = el.getBoundingClientRect();
      const x = ((lastEvent.clientX - rect.left) / rect.width) * 100;
      const y = ((lastEvent.clientY - rect.top) / rect.height) * 100;

      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
    };

    const onPointerMove = (event: PointerEvent) => {
      lastEvent = event;
      if (!frame) frame = requestAnimationFrame(update);
    };

    const onPointerLeave = () => {
      el.style.setProperty("--mx", "50%");
      el.style.setProperty("--my", "0%");
    };

    el.addEventListener("pointermove", onPointerMove, { passive: true });
    el.addEventListener("pointerleave", onPointerLeave, { passive: true });

    cleanups.push(() => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
      if (frame) cancelAnimationFrame(frame);
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}
```

---

## 16. 跨平台差异处理

### 16.1 在前端识别平台

安装 Tauri API 后，可以读取平台信息。

```ts
import { platform } from "@tauri-apps/plugin-os";

export function applyPlatformClass() {
  const current = platform();
  document.documentElement.dataset.platform = current;
}
```

CSS：

```css
[data-platform="macos"] .app-titlebar {
  padding-left: 78px;
}

[data-platform="windows"] .app-titlebar {
  padding-left: 12px;
}

[data-platform="linux"] {
  --glass-blur: 16px;
  --glass-saturate: 1.25;
}
```

### 16.2 macOS 建议

- 使用系统语义材质作为窗口底色。
- 自定义标题栏时保留红黄绿按钮区域。
- 不要让强透明背景影响正文阅读。
- 如果目标是 Mac App Store，谨慎使用 `macOSPrivateApi`。

### 16.3 Windows 建议

- Windows 11 主窗口使用 Mica。
- Acrylic 更适合小浮层或临时窗口。
- 遇到性能问题时降低 CSS blur。
- 注意 Windows 不同版本的 WebView2 表现差异。

### 16.4 Linux 建议

- 把 Linux 当作 CSS-only 降级目标。
- 提供渐变背景和实色 fallback。
- 避免过度依赖窗口透明。

---

## 17. 测试清单

### 17.1 视觉测试

- [ ] 浅色模式文字是否清晰。
- [ ] 深色模式文字是否清晰。
- [ ] 背景复杂时卡片是否仍可读。
- [ ] 弹窗是否有足够遮罩。
- [ ] hover / active 是否自然。
- [ ] 自定义标题栏拖拽是否正常。
- [ ] macOS 红黄绿按钮是否被遮挡。
- [ ] Windows 窗口阴影是否正常。

### 17.2 可访问性测试

- [ ] 键盘 Tab 顺序正常。
- [ ] `:focus-visible` 清楚可见。
- [ ] 减少动态效果后没有缩放动画。
- [ ] 减少透明度后 UI 变为更实色。
- [ ] 高对比度模式下文字仍清晰。
- [ ] 按钮和表单有正确 aria 属性。

### 17.3 性能测试

- [ ] 窗口缩放不卡顿。
- [ ] 侧边栏滚动不卡顿。
- [ ] 大量卡片时 hover 不掉帧。
- [ ] 弹窗打开动画流畅。
- [ ] Windows Acrylic 下拖动窗口可接受。
- [ ] 低性能设备自动进入 `solid` 或 `soft` 模式。

---

## 18. 常见问题

### Q1：为什么设置了透明窗口，但看不到玻璃效果？

检查：

- `tauri.conf.json` 是否设置 `transparent: true`。
- `html, body, #root` 是否都是 `background: transparent`。
- 是否有顶层容器使用了不透明背景。
- macOS 是否开启了 `macOSPrivateApi`。
- 组件背景是否半透明。

### Q2：为什么 `backdrop-filter` 没有效果？

常见原因：

- 元素背景不透明。
- 元素背后没有可见内容。
- WebView / 浏览器版本不支持。
- CSS 被覆盖。

建议同时写：

```css
backdrop-filter: blur(24px);
-webkit-backdrop-filter: blur(24px);
```

### Q3：为什么文字发灰、不清晰？

原因通常是透明度过高或背景太复杂。

解决：

- 提高 `--glass-bg` 的 alpha。
- 正文容器使用 `--glass-bg-strong`。
- 降低背景图对比度。
- 增加文字不透明度。
- 开启 `solid` 模式。

### Q4：为什么动画卡顿？

优先检查：

- 是否有大面积 `backdrop-filter`。
- 是否在 `pointermove` 中使用 React state。
- 是否同时存在多个大面积玻璃层。
- 是否动画了 `width`、`height`、`top`、`left` 等布局属性。

解决：

- 动画只使用 `transform` 和 `opacity`。
- 减少 blur 半径。
- 限制玻璃层面积。
- 使用 `requestAnimationFrame` 节流。
- 默认使用 `soft`，高级设置里提供 `liquid`。

### Q5：是否应该 100% 模仿 Apple Liquid Glass？

不建议。更好的方式是学习它的原则：

- 玻璃层浮在内容层之上。
- 控件和导航使用独立材质层。
- 透明度服务于层级，而不是装饰。
- 可读性优先于炫技。
- 动效轻微、自然、及时。

---

## 19. 发布前检查清单

### 基础功能

- [ ] macOS 启动正常。
- [ ] Windows 启动正常。
- [ ] Linux 至少可用。
- [ ] 窗口可拖拽。
- [ ] 窗口可缩放。
- [ ] 自定义标题栏按钮不影响拖拽。

### 主题

- [ ] 浅色主题完成。
- [ ] 深色主题完成。
- [ ] 跟随系统完成。
- [ ] `solid` 模式完成。
- [ ] `soft` 模式完成。
- [ ] `liquid` 模式完成。
- [ ] 主题设置持久化。

### 组件

- [ ] Button
- [ ] Card
- [ ] Sidebar
- [ ] Input
- [ ] Modal
- [ ] Switch
- [ ] Segmented Control
- [ ] Dropdown / Menu
- [ ] Toast

### 可访问性

- [ ] 键盘可访问。
- [ ] 焦点样式清晰。
- [ ] 减少动态效果可用。
- [ ] 减少透明度可用。
- [ ] 高对比度可用。

### 性能

- [ ] 大窗口拖拽不卡顿。
- [ ] 模糊区域数量受控。
- [ ] 动态高光未触发 React 重渲染。
- [ ] 低性能设备有降级策略。

---

## 最小可用版本总结

如果只想先做出第一版，可以按下面顺序实现：

1. Tauri 开启透明窗口、无边框、自定义标题栏。
2. macOS 配置 `windowEffects`，Windows 配置 `mica`。
3. `html/body/#root` 设置透明。
4. 加入 `tokens.css`、`glass.css`。
5. 封装 `GlassButton`、`GlassCard`、`GlassSidebar`。
6. 加入鼠标追踪高光。
7. 加入 `solid / soft / liquid` 三档玻璃强度。
8. 加入 `prefers-reduced-motion` 和 `prefers-reduced-transparency` 降级。

这 8 步完成后，就能得到一套比较完整、可维护、跨平台可降级的 Tauri 液态玻璃风格主题。
