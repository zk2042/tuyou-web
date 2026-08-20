/**
 * 自制轻量富文本工具
 * ==============================================================
 * 1. sanitizeHtml —— XSS 白名单过滤
 *    仅放行：
 *      标签   h1 h2 h3 h4 h5 h6 p br strong b em i u del s a img
 *             ul ol li blockquote pre code hr span
 *      属性   a.href(仅 http/https/mailto/相对路径) a.target
 *             img.src(仅 http/https/data:image) img.alt img.title
 *             class(仅白名单前缀)
 *    style 一律剥离（小程序 RichText 也不依赖 style，我们用语义标签 + CSS 控制）
 *
 * 2. htmlToText —— 从 HTML 提取纯文本（用于字数统计 / 空内容判定）
 *
 * 3. escapeHtml —— 通用 escape
 */

const ALLOWED_TAGS: Record<string, Record<string, (v: string) => string | false>> = {
  h1: {}, h2: {}, h3: {}, h4: {}, h5: {}, h6: {},
  p: {}, br: {},
  strong: {}, b: {}, em: {}, i: {}, u: {}, del: {}, s: {},
  blockquote: {}, pre: {}, code: {}, hr: {}, span: {},
  ul: {}, ol: {}, li: {},
  //+ div 仅作为兼容入口：Chrome contenteditable Enter 默认生成 <div>，
  //+ sanitize 末尾会把 div 转成 p，统一段落语义
  div: {},
  a: {
    href: (v: string) => {
      const s = String(v || '').trim()
      if (!s) return false
      if (/^(https?:|mailto:|tel:|\/\/)/i.test(s) || s.startsWith('/') || s.startsWith('#')) {
        return s.replace(/"/g, '&quot;')
      }
      return false
    },
    target: (v: string) => (String(v) === '_blank' ? '_blank' : false),
    rel: (_v: string) => 'noopener noreferrer',
  },
  img: {
    src: (v: string) => {
      const s = String(v || '').trim()
      if (!s) return false
      if (/^(https?:|\/\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);)/i.test(s) || s.startsWith('/')) {
        return s.replace(/"/g, '&quot;')
      }
      return false
    },
    alt: (v: string) => escapeHtml(String(v || '').slice(0, 200)),
    title: (v: string) => escapeHtml(String(v || '').slice(0, 200)),
  },
}

const ALLOWED_CLASS_PREFIXES = ['md-', 'nut-']
function isAllowedClass(cls: string) {
  return ALLOWED_CLASS_PREFIXES.some((pfx) =>
    String(cls || '').split(/\s+/).every((c) => c.startsWith(pfx) || c === ''),
  )
}
// Allow "class" on any tag but only with white-listed prefixes
Object.keys(ALLOWED_TAGS).forEach((tag) => {
  if (tag !== 'br' && tag !== 'hr') {
    ALLOWED_TAGS[tag].class = (v: string) => (isAllowedClass(v) ? String(v) : false)
  }
})

/** Escape & < > " ' for safe HTML */
export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Unescape HTML entities → plain string */
export function unescapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
}

/**
 * HTML 白名单清理 —— 只保留允许的标签/属性，其他一律 escape 成文本或剥离
 * 用法：
 *   const safe = sanitizeHtml(dirty)
 *   <div dangerouslySetInnerHTML={{ __html: safe }} />
 */
export function sanitizeHtml(dirty: string): string {
  const src = String(dirty ?? '')
  // 1) 剥离 script / style / iframe / 注释 / 事件属性（先粗暴整段干掉防止后续构造绕过）
  let s = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*script[\s\S]*?<\/\s*script\s*>/gi, '')
    .replace(/<\s*style[\s\S]*?<\/\s*style\s*>/gi, '')
    .replace(/<\s*iframe[\s\S]*?<\/\s*iframe\s*>/gi, '')
    .replace(/<\s*(object|embed|link|meta|form|input|button|textarea|select|option)[\s\S]*?\/?\s*>/gi, '')

  // 2) 用正则逐标签处理（只保留白名单标签，其余去掉标签保留内部文本）
  // 使用函数 replace，针对每个 <tag attr=val ...> 和 </tag> 做决策
  type M = { open: boolean; close: boolean; slashClose: boolean; name: string; attrs: string }
  const tagRe = /<(\/)?\s*([a-zA-Z0-9-]+)\s*([^>]*?)\s*(\/)?>/g
  s = s.replace(tagRe, (_m: string, slash: string | undefined, rawName: string, rawAttrs: string, selfClose: string | undefined): string => {
    const name = rawName.toLowerCase()
    const allowed = ALLOWED_TAGS[name]
    const isClose = !!slash
    const isSelfClose = !!selfClose || name === 'br' || name === 'hr' || name === 'img'

    if (!allowed) {
      // 非白名单标签 → 去除，保留内部文本（防止吞字）
      return ''
    }

    if (isClose) {
      return `</${name}>`
    }

    // 解析属性（支持 attr="val" / attr='val' / attr）
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
    const attrs: string[] = []
    let m: RegExpExecArray | null
    while ((m = attrRe.exec(rawAttrs)) !== null) {
      const rawKey = m[1]
      const key = rawKey.toLowerCase()
      const val = m[3] ?? m[4] ?? m[5] ?? ''
      // 所有事件属性（on*）全部剥离
      if (key.startsWith('on')) continue
      if (key === 'style') continue
      if (key === 'href' || key === 'src') {
        // javascript: 协议直接干掉
        if (/^\s*javascript\s*:/i.test(val)) continue
      }
      const checker = allowed[key]
      if (checker) {
        const cleaned = checker(val)
        if (cleaned !== false) {
          // class 不需要引号包裹因为校验过值；其他一律引号
          attrs.push(`${key}="${String(cleaned)}"`)
        }
      }
    }
    const attrsStr = attrs.length ? ' ' + attrs.join(' ') : ''
    return isSelfClose ? `<${name}${attrsStr} />` : `<${name}${attrsStr}>`
  })

  //+ div → p 转换：Chrome contenteditable 的 Enter 默认生成 <div>，
  //+ 统一转成 <p> 让渲染端 .md-content 的 p 样式生效，保留段落间距
  s = s
    .replace(/<div([^>]*)>/gi, '<p$1>')
    .replace(/<\/\s*div\s*>/gi, '</p>')

  return s
}

/**
 * HTML → 纯文本（用于字数统计）
 */
export function htmlToText(html: string): string {
  const s = String(html ?? '')
    // 块级换行：</p>/</div>/</hN>/</li>/<br>/<hr> 替换成换行，便于按"行"看字数
    .replace(/<\/\s*(p|div|h[1-6]|li|blockquote|pre|tr|section|article|header|footer)\s*>/gi, '\n')
    .replace(/<\s*(br\s*\/?|hr\s*\/?)\s*>/gi, '\n')
    // 剥离剩余标签
    .replace(/<[^>]+>/g, '')
  return unescapeHtml(s).replace(/\u00a0/g, ' ')
}

/**
 * 空内容判定：去除空白/换行/零宽后长度为 0
 */
export function isHtmlEmpty(html: string): boolean {
  return htmlToText(html).trim().replace(/[\u200B-\u200D\uFEFF]/g, '') === ''
}

/**
 * 按"纯文本字符数"截断 HTML（尽量不破坏结构）—— 富文本 maxLength 兜底
 */
export function truncateHtmlByText(html: string, max: number): { html: string; truncated: boolean } {
  const text = htmlToText(html)
  if (text.length <= max) return { html, truncated: false }

  // 策略：直接保留前 N 字符，然后在最后追加 sanitize 过的文本，避免破坏标签
  const kept = escapeHtml(text.slice(0, max))
  return { html: `<p>${kept}</p>`, truncated: true }
}

/**
 * 详情页正文内容统一归一化
 * ============================================================
 * 编辑器升级后，后端 content 字段可能存两种格式：
 *   ① 旧数据：Markdown 纯文本 或 纯文本（没有任何标签）
 *   ② 新数据：富文本 HTML 字符串
 *
 * 自动识别：
 *   - 如果含明显的 HTML 标签（<xx> 或 <xx/>）→ 直接 sanitizeHtml（信任语义标签）
 *   - 否则视为 Markdown/纯文本 → 走 renderMarkdown 转 HTML（保留原排版）
 *
 * 返回可直接 dangerouslySetInnerHTML / RichText nodes 使用的安全 HTML
 */
import { renderMarkdown } from './markdown'

const LOOKS_LIKE_HTML = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>|<\/[a-zA-Z][a-zA-Z0-9-]*\s*>|<[a-zA-Z][a-zA-Z0-9-]*\s*\/?>/

export function normalizeDetailHtml(content: string | undefined | null): string {
  const raw = String(content ?? '').trim()
  if (!raw) return ''
  if (LOOKS_LIKE_HTML.test(raw)) {
    return sanitizeHtml(raw)
  }
  return renderMarkdown(raw)
}

