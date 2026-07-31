---
title: 笔记标题
created: 2026-07-31
updated: 2026-07-31
summary: 一句话摘要（显示在 learning map 的搜索结果和图节点上）。
tags: tag1, tag2
---

<!-- 第一部分：视频。把 YouTube / Bilibili 链接单独放一行，自动嵌成 16:9 播放器。 -->

https://www.youtube.com/watch?v=dQw4w9WgXcQ

## Transcript

<!-- 第二部分：手打 transcript。行内公式 $E = mc^2$，独立公式： -->

$$
\int_{-\infty}^{\infty} e^{-x^2}\,\mathrm{d}x = \sqrt{\pi}
$$

正文里指向另一条笔记，就写站点根目录起的绝对路径：[比较无穷大](/learning/infinity-comparison)。
这只是正文里的一个链接；图上的那条边要另外在 `learning.json` 的 `edges` 里加一条
`{ "from": "<本篇 slug>", "to": "infinity-comparison" }`——两者是分开的，见 CLAUDE.md。

<!--
新建一条笔记：
1. 复制本文件为 posts/learning/<slug>.md，改 frontmatter。
2. 在 learning.json 的 nodes 里加一条记录（slug / file / title / created / updated /
   summary / tags），要与 frontmatter 一致；tags 在这里是数组，在 frontmatter 里是逗号串。
3. 要连边就在 edges 里加 { "from": …, "to": … }。
4. python3 build_pages.py
本文件名以 _ 开头，因此不会被当成笔记，也不在 learning.json 里。
-->
