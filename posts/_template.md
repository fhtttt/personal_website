---
title: 文章标题
category: Information Theory
created: 2026-07-13
updated: 2026-07-13
summary: 一句话摘要（显示在列表和搜索里）。
tags: tag1, tag2
---

正文从这里开始，支持标准 Markdown。写新文章时：复制这个文件为 `posts/<slug>.md`，
改上面的 frontmatter，然后在 `posts.json` 里加一条记录（见 CLAUDE.md）。

## 小标题

**加粗**、*斜体*、`行内代码`、[链接](https://example.com)。

> 引用块。

- 列表项一
- 列表项二

## 数学（LaTeX）

行内公式用单个 `$`：香农熵 $H(X) = -\sum_i p_i \log p_i$。

独立公式用双 `$$`：

$$
I(X;Y) = \sum_{x,y} p(x,y)\,\log\frac{p(x,y)}{p(x)\,p(y)}
$$

（要写字面的美元符号，用 `\$`。）

## 图片

把图片放到 `assets/images/` 下，用从站点根目录起的相对路径引用：

![图片说明](assets/images/example.png)

## 视频

把 YouTube 或 Bilibili 视频链接**单独放一行**，会自动嵌入成响应式播放器：

https://www.youtube.com/watch?v=dQw4w9WgXcQ

https://www.bilibili.com/video/BV1GJ411x7h7

## 代码块

```python
def entropy(p):
    from math import log2
    return -sum(pi * log2(pi) for pi in p if pi > 0)
```
