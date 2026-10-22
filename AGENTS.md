# AGENTS.md

Project-specific guidance for AI coding agents.

CitePilot 是持续的 GEO/AEO 监测工具。产品循环是四步：基线监测、整站和内容分发、一段时间后再监测、与基线对比。一轮见效后可以把最近这批当作下一轮的基线，不必加数据库标记。四周自测只是可选的首次验证，默认折叠。同一批次、同一道题可以有多条粘贴回答，每条标平台（列表或自定义）。提及率和引用率按样本算。品牌资料里的竞品含名称、别名和域名，用来算声量占比和平均排名。界面把被监测的主体叫「品牌」。品牌页只编辑出题和监测用的基本信息，以及语气、禁用词、合规红线；可分享素材在素材库。模型在「设置」里配置，没有保存配置时回退到 `DEEPSEEK_API_KEY`，题库、摘要和起草走模板和规则。Worker API 在 `worker/`（Hono），页面在 `web/`（React 19 + Vite），纯函数在 `shared/`，D1 迁移在 `migrations/`。本地先 `npm run db:migrate`，再用 `npm run dev`。监测只接受粘贴的回答，诊断只抓取公开 http(s) 页面。



<!-- ASTRYX:START -->
Astryx v0.7.1 · 168 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx template <Block>` for parts it lacks; `astryx component <Name>` to read props before using one.
Changing an existing page? Keep it: skip step 2 and add blocks/components inside its sections.

RULES:
- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then the xstyle prop / StyleX tokens. No raw hex/px.
- Palettes and custom colors go through the theme, never :root overrides. Run `astryx theme add <slug>` to import; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any className=, style={{…}}, raw <div>/<span>, imported .css/@apply, or hardcoded #hex/px with the component or the xstyle prop + a token.

`astryx help` lists every command. Key ones beyond the workflow:
  search "<query>"   find any component / hook / doc / template
  discover <words>   integrations you could add
  docs <topic>       getting-started, principles, tokens, theme … (`astryx docs` lists all)
  docs cli           commands, API reference, integration authoring
  upgrade --from <old version> --apply   run after a dependency bump
<!-- ASTRYX:END -->
