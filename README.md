# CitePilot

持续监测回答引擎会不会提到你、会不会引用你的公开页。产品循环是四步，不是按周打卡。

1. **基线监测**：新建或选中一个轮次，类型标成基线。把题库里的题拿到各回答引擎去问，再把回答粘贴回来。
2. **整站+内容分发**：诊断公开页，用内容起草写出稿子。发布由你自己完成，这里不代发。
3. **一段时间后再监测**：新建一个轮次，名称用当天日期或「改站后」，用同一套题再测一遍。
4. **与基线对比**：对比页左侧选基线，右侧选后来的监测，看提及和引用有没有抬升。

一轮见效之后，可以把最近这批当作下一轮的基线：对比时把它放在左侧，或新建时把类型选成基线。

不做多平台一键发布，也不登录去爬 ChatGPT、豆包或其他对话产品。监测只解析你粘贴的文本。种子里的「示例·优化前」和「示例·优化后」是一对历史样本，用来演示第 4 步。

## 技术栈

- API：Cloudflare Workers + Hono
- 数据：Cloudflare D1（`migrations/`）
- 前端：React 19 + Vite，由 Workers 静态资源同仓提供
- 界面：Astryx（`@astryxdesign/core`、`@astryxdesign/theme-neutral`、`@stylexjs/stylex`）
- 模型：DeepSeek 的 OpenAI 兼容接口。没有密钥时，题库、摘要和诊断建议走本地模板与规则

## 本地运行

需要 Node.js 22+。

```bash
npm install
npm run db:migrate
npm run dev
```

`npm run dev` 会先把迁移应用到本地 D1，再启动 Vite。Vite 插件使用 Wrangler / workerd，页面和 `/api` 在同一个地址，默认是 <http://127.0.0.1:5173>。

打开后会看到种子工作室「澄川智能体工场」、20 道中文题，以及一对历史样本「示例·优化前」「示例·优化后」。示例官网是 `https://example.com`，方便直接跑诊断；日常使用时改成你的真实站点。

其他命令：

```bash
npm test                 # 解析、题库、诊断、对比的单元测试
npm run typecheck
npm run build            # 类型检查 + 生产构建
npm run preview          # 用 Workers 运行时预览构建结果
npx wrangler dev         # 只跑 Worker。页面开发请用 npm run dev
npm run deploy           # 构建后 wrangler deploy。部署前先换成真实的 D1 id
```

`npm run dev` 已包含 Worker。单独执行 `npx wrangler dev` 时，API 可用；静态页面以 Vite 构建结果为准。

## 配置 DeepSeek

复制环境文件并填入密钥。密钥不要写进 `wrangler.toml` 或提交到 git。

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars`：

```bash
DEEPSEEK_API_KEY=sk-...
# 可选。下面两项在 wrangler.toml 里已有默认值。
# DEEPSEEK_BASE_URL=https://api.deepseek.com
# DEEPSEEK_MODEL=deepseek-chat
```

也认 `OPENAI_API_KEY`，但 `DEEPSEEK_API_KEY` 优先。`DEEPSEEK_BASE_URL` 默认 `https://api.deepseek.com`，请求发到 `{BASE_URL}/chat/completions`。`DEEPSEEK_MODEL` 默认 `deepseek-chat`。

改完后重启 `npm run dev`。概览页会显示是否已连接模型。

有密钥时：

- 「生成题目」优先让 DeepSeek 按档案写新的中文问题，失败或结果不合格则退回模板
- 诊断建议优先让模型根据清单改写，清单本身仍由规则计算
- 监测摘要会让模型用中文解释规则结果。品牌是否出现、网址和竞品仍以规则为准，避免模型编造引用

没有密钥时，上面三处都用模板和规则，主流程可以完整走通。

线上密钥：

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

## 循环里的页面

1. **档案 / 题库**：名称、官网、定位、服务、竞品、关键词，以及起草用的能力、案例、目标客户、解决方案。题库覆盖品牌、品类、对比、场景，基线和再监测用同一套题。
2. **监测**：选择批次和平台，粘贴回答。结果标出是否提到品牌、是否引用官网、提到哪些竞品。
3. **诊断**：抓取公开页、`/robots.txt` 和 `/llms.txt`。内网、本机和云元数据地址会被拒绝。
4. **内容起草**：按档案和渠道生成标题、正文、可引用句子和建议网址。复制后由你自己发布。
5. **对比**：左侧是基线，右侧是后来的监测。

种子数据里，「示例·优化后」的品牌提及率高于「示例·优化前」。这些记录可以删掉，换成你自己的粘贴。

## 四周自测（可选）

只在第一次验证时用，走完就回到上面的四步循环。工具不代你发内容，发布在你自己的站点完成。

| 周 | 做什么 |
| --- | --- |
| 第 0 周 | 核对档案。确认题库覆盖四个簇。新建一个抽查批次，把同一批题拿到 ChatGPT、DeepSeek、豆包、Kimi 等平台去问，再把回答粘贴回来。 |
| 第 1 周 | 对官网跑诊断。优先补标题、描述、单一 H1、常见问题、Organization 或 FAQ 结构化数据，以及 `/llms.txt`。用「内容起草」挂上一个未通过项，生成 FAQ 或官网长文，先审再决定贴不贴。 |
| 第 2 周 | 把审过的草稿贴回自己的网站，包括官网长文、FAQ 和「产品宣传」。补上可引用的定义、服务边界和案例。 |
| 第 3 周 | 再新建一个抽查批次，抽几条对比题和场景题问一遍，看自有网址有没有开始出现。 |
| 第 4 周 | 把第一次抽查的题补进新批次，打开对比页任选这两批。差距留给下一次改页。 |

概览页把同一份说明收在「四周自测（可选）」里，默认折叠。日常按上面的四步循环，不用按周。

## 内容起草

诊断出缺口后，打开「内容起草」。渠道包括官网长文、FAQ页、公众号、小红书、LinkedIn/行业稿、社媒短帖和产品宣传。可以挂一道题库里的题，或一次诊断里未通过的检查项。

生成结果有标题、正文、建议被引用的句子，以及建议落地网址。有 DeepSeek 密钥时，模型按档案改写；没有密钥时，用能力、案例、目标客户和解决方案套中文模板。核对后保存到草稿箱，再复制到你自己的官网或账号。草稿箱里可以再次打开，修改标题、正文和渠道后保存，会更新原来的记录并记下最后编辑时间。也可以另存为一篇新稿，或确认后删除。

这一步不登录、不代发，也没有各平台的 OAuth。要上线的句子，由你贴回自己的站点。

## 部署

`wrangler.toml` 里的 `database_id` 是本地占位。部署前：

```bash
npx wrangler d1 create citepilot
```

把返回的 id 写回 `wrangler.toml` 的 `database_id`，然后：

```bash
npx wrangler d1 migrations apply citepilot --remote
npm run deploy
```

远程迁移会写入种子工作室和示例记录。若生产库不要示例监测，可在部署后于界面删除那些记录，或只在远程执行 `migrations/0001_init.sql`。

## 目录

```text
worker/        Hono API
web/           React 页面
shared/        解析、题库模板、诊断、对比
migrations/    D1 迁移与种子数据
```

组件用法以 `AGENTS.md` 里的 Astryx 说明和 `npx astryx component <Name>` 为准。
