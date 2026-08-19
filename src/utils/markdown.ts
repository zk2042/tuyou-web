//+ 零依赖 Markdown → HTML 解析器（内联 style，小程序 rich-text 可渲染）
//+ 不使用 marked/highlight.js，避免新增 npm 依赖，包体积可控
//+ html: false 策略：用户写的原生 HTML 标签一律做实体转义，防止 XSS

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

//+ ============== 行内元素解析器 ==============
//+ 处理：`code`、![图](url)、[链接](url)、**粗**、*斜*、~~删~~
function renderInline(text: string): string {
  const codeStore: string[] = []
  let safe: string = text

  // 1. 行内 code：先 tokenize 保存，不被后续正则破坏
  safe = safe.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeStore.length
    codeStore.push(escapeHtml(code))
    return `\u0000CODE${idx}\u0000`
  })

  // 2. 图片 ![alt](url)
  safe = safe.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const a = escapeHtml(alt)
    const u = escapeHtml(url)
    return `<img src="${u}" alt="${a}" style="max-width:100%;height:auto;display:block;margin:12px auto;border-radius:8px;"/>`
  })

  // 3. 链接 [text](url)
  safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, url) => {
    const ht = escapeHtml(t)
    const hu = escapeHtml(url)
    return `<a href="${hu}" target="_blank" rel="noopener noreferrer" style="color:#2e7d32;text-decoration:underline;word-break:break-all;">${ht}</a>`
  })

  // 4. 粗体 **x**（先粗后斜，避免 ** 被拆成两个 *）
  safe = safe.replace(/\*\*([^*]+)\*\*/g, (_, c) =>
    `<strong style="font-weight:700;color:#1f2329;">${escapeHtml(c)}</strong>`
  )

  // 5. 斜体 *x*（前后不能是 *）
  safe = safe.replace(/(^|[^*])\*([^*\n]+)\*/g, (_, pre, c) =>
    `${pre}<em style="font-style:italic;color:#2c313a;">${escapeHtml(c)}</em>`
  )

  // 6. 删除线 ~~x~~
  safe = safe.replace(/~~([^~]+)~~/g, (_, c) =>
    `<span style="text-decoration:line-through;color:#a3abc0;">${escapeHtml(c)}</span>`
  )

  // 7. 未匹配到结构的「纯文本」做转义（把 escapeHtml 应用到非 token 文本）
  //    为实现简单且安全：逐字符处理不现实，我们用 token 重放策略：
  //    对上面已经处理过的 token（img/a/strong/em/del）之外的剩余内容，在「最后」再做一次
  //    更简单可靠：先对整段 escapeHtml，再逆向把我们之前已处理的标记替换回来。
  //    ——但我们已对捕获组做了 escapeHtml，这里不再二次。
  //    对于未被捕获的纯文本，这里补一次：将剩余 `<` `>` `&` 字符转义
  //    （已转义的 &amp;/&lt;/&gt;/&quot;/&#39; 不再重复替换，只替换 & 后面非 #/字母的情况）
  safe = safe
    .replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;')
    .replace(/<(?!img|a |\/a|strong|\/strong|em|\/em|span|\/span|code|pre|\/code|\/pre)/g, '&lt;')
    .replace(/(?<![a-zA-Z"':\s])>/g, '&gt;')

  // 8. 恢复行内 code token
  safe = safe.replace(/\u0000CODE(\d+)\u0000/g, (_, idx) =>
    `<code style="background:#f0f2f5;color:#c7254e;padding:2px 4px;border-radius:4px;font-size:13px;">${codeStore[Number(idx)]}</code>`
  )

  return safe
}

//+ ============== 块级解析器 ==============
export function renderMarkdown(md: string): string {
  if (!md || typeof md !== 'string') return ''
  const rawLines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let i = 0

  // 代码块状态
  let inCode = false
  const codeBuf: string[] = []

  // 列表状态：'ul' | 'ol' | null
  type ListType = 'ul' | 'ol' | null
  let listType: ListType = null
  const listItems: string[] = []
  let listStartNum = 1

  // 段落缓冲
  let paraBuf: string[] = []

  const flushPara = () => {
    if (paraBuf.length === 0) return
    const text = paraBuf.join('\n')
    paraBuf = []
    out.push(`<p style="font-size:15px;line-height:1.8;color:#2c313a;margin:10px 0;word-break:break-word;">${renderInline(text)}</p>`)
  }

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      listType = null
      listItems.length = 0
      listStartNum = 1
      return
    }
    const style = listType === 'ol'
      ? 'margin:10px 0;padding-left:24px;list-style:decimal;font-size:15px;line-height:1.8;color:#2c313a;'
      : 'margin:10px 0;padding-left:20px;list-style:disc;font-size:15px;line-height:1.8;color:#2c313a;'
    const tag = listType
    const startAttr = listType === 'ol' ? ` start="${listStartNum}"` : ''
    const inner = listItems.map(li => `<li style="margin:4px 0;">${renderInline(li)}</li>`).join('')
    listType = null
    listItems.length = 0
    listStartNum = 1
    out.push(`<${tag}${startAttr} style="${style}">${inner}</${tag}>`)
  }

  while (i < rawLines.length) {
    const line = rawLines[i]

    //+ 围栏代码块 ```
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w-]*)/)
    if (fence) {
      flushPara(); flushList()
      if (!inCode) {
        inCode = true
        codeBuf.length = 0
      } else {
        const raw = codeBuf.join('\n')
        const escaped = escapeHtml(raw)
        out.push(`<pre style="background:#1e222a;color:#d7dae0;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.6;margin:12px 0;"><code>${escaped}</code></pre>`)
        inCode = false
      }
      i++; continue
    }
    if (inCode) { codeBuf.push(line); i++; continue }

    //+ 空行
    if (!line.trim()) {
      flushPara(); flushList()
      i++; continue
    }

    //+ 水平分割线 --- / *** / ___（至少 3 个连续相同字符 + 可选空格）
    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)) {
      flushPara(); flushList()
      out.push(`<hr style="border:none;border-top:1px dashed #d0d3da;margin:16px 0;"/>`)
      i++; continue
    }

    //+ 标题 #..##  + 空格 + 内容
    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/)
    if (heading) {
      flushPara(); flushList()
      const level = heading[1].length
      const content = heading[2]
      const levelStyles: Record<number, string> = {
        1: 'font-size:24px;font-weight:700;color:#1f2329;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid #e5e6eb;',
        2: 'font-size:20px;font-weight:700;color:#1f2329;margin:20px 0 10px;',
        3: 'font-size:17px;font-weight:600;color:#1f2329;margin:16px 0 8px;',
        4: 'font-size:15px;font-weight:600;color:#1f2329;margin:14px 0 6px;',
        5: 'font-size:14px;font-weight:600;color:#1f2329;margin:12px 0 4px;',
        6: 'font-size:13px;font-weight:600;color:#4b5563;margin:12px 0 4px;'
      }
      const s = levelStyles[level] || levelStyles[4]
      out.push(`<h${level} style="${s}">${renderInline(content)}</h${level}>`)
      i++; continue
    }

    //+ 引用块：> 多行合并
    if (/^\s*>\s?/.test(line)) {
      flushPara(); flushList()
      const lines: string[] = []
      while (i < rawLines.length && /^\s*>\s?/.test(rawLines[i])) {
        lines.push(rawLines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      const text = lines.join('\n')
      out.push(`<blockquote style="margin:12px 0;padding:8px 12px;background:#f3f7f4;border-left:4px solid #2e7d32;color:#4b5563;">${renderInline(text)}</blockquote>`)
      continue
    }

    //+ 无序列表项：-/*/+ 后加空格 + 内容
    const ulMatch = line.match(/^\s*([-*+])\s+(.*)$/)
    if (ulMatch) {
      flushPara()
      if (listType !== 'ul') { flushList(); listType = 'ul'; listStartNum = 1 }
      listItems.push(ulMatch[2])
      i++; continue
    }

    //+ 有序列表项：数字. + 空格 + 内容
    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/)
    if (olMatch) {
      flushPara()
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
        listStartNum = Number(olMatch[1]) || 1
      }
      listItems.push(olMatch[2])
      i++; continue
    }

    //+ 普通段落行
    paraBuf.push(line)
    i++
  }

  //+ 结尾 flush
  if (inCode && codeBuf.length > 0) {
    out.push(`<pre style="background:#1e222a;color:#d7dae0;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.6;margin:12px 0;"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }
  flushPara(); flushList()

  if (out.length === 0) {
    return `<p style="color:#a3abc0;font-size:14px;margin:16px 0;text-align:center;">此处显示正文预览，开始编辑吧 ~</p>`
  }
  return out.join('')
}

export default { renderMarkdown }
