import { useMemo } from 'react'
import { renderMarkdown } from '@/utils/markdown'

export function useMarkdownRender(md: string) {
  return useMemo(() => renderMarkdown(md || ''), [md])
}

export default useMarkdownRender
