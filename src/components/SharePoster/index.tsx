//+ 活动分享海报组件
//+ 流程：
//+   1. JS 拿到当前活动详情页完整 H5 链接
//+   2. qrcode 库本地把 URL 生成二维码（canvas 绘制）
//+   3. canvas 合成海报：背景图（活动封面） + 标题 + 二维码 + 提示
//+   4. 输出 base64 图片，用户长按保存到相册
//+ 微信 H5 限制：JS 不能直接调用 API 保存相册，只能输出图片让用户手动长按保存
import { useEffect, useState, useRef, useCallback } from 'react'
import Taro from '@tarojs/taro'
import QRCode from 'qrcode'
import { Close } from '@nutui/icons-react'
import './index.less'

export interface SharePosterProps {
  visible: boolean
  onClose: () => void
  activityTitle: string
  activityCover: string
  shareUrl: string

}

const SharePoster: React.FC<SharePosterProps> = ({
  visible,
  onClose,
  activityTitle,
  activityCover,
  shareUrl,
  
}) => {
  const [posterDataUrl, setPosterDataUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
  const canvasRef = useRef<HTMLCanvasElement>(null)

  //+ 加载图片用于 canvas 合成
  //+ 方案：fetch 拿 blob URL → img.decode() 等待真正解码 → 用于 drawImage
  //+ 关键：移动端（iOS Safari/微信浏览器）img.onload 触发时图片可能还未解码完成，
  //+       drawImage 会画不出来，必须用 img.decode() 等待解码完成
  //+ blob URL 是同源的，不会污染 canvas，toDataURL 正常
  const loadImage = useCallback(async (src: string): Promise<HTMLImageElement> => {
    //+ 路径1：fetch 转 blob URL（推荐，绕过 canvas CORS 污染）
    try {
      const response = await fetch(src, { mode: 'cors' })
      if (!response.ok) throw new Error(`fetch 状态码 ${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      try {
        const img = new Image()
        img.src = objectUrl
        //+ 关键：等待图片真正解码完成，避免移动端 drawImage 画不出来
        if (typeof img.decode === 'function') {
          await img.decode()
        } else {
          //+ 老浏览器降级到 onload
          await new Promise((res, rej) => {
            img.onload = () => res(img)
            img.onerror = () => rej(new Error('图片加载失败'))
          })
        }
        return img
      } finally {
        //+ 注意：decode 完成后才能 revoke，否则 drawImage 时图片可能被回收
        //+ 这里延迟释放，等 canvas 合成完毕
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
      }
    } catch (err: any) {
      //+ 路径2：fetch 失败兜底，直接用原 URL + crossOrigin 加载
      //+ 要求图片服务器返回 Access-Control-Allow-Origin
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = src
      if (typeof img.decode === 'function') {
        await img.decode()
      } else {
        await new Promise((res, rej) => {
          img.onload = () => res(img)
          img.onerror = () => rej(new Error('图片加载失败'))
        })
      }
      return img
    }
  }, [])

  //+ canvas 文字换行：超出宽度自动换行，返回行数组
  const wrapText = useCallback((
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number
  ): string[] => {
    const lines: string[] = []
    let current = ''
    for (const ch of text) {
      const test = current + ch
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current)
        current = ch
        if (lines.length >= maxLines - 1) break
      } else {
        current = test
      }
    }
    if (current) {
      if (lines.length >= maxLines - 1) {
        //+ 最后一行截断加省略号
        while (ctx.measureText(current + '...').width > maxWidth && current.length > 0) {
          current = current.slice(0, -1)
        }
        lines.push(current + '...')
      } else {
        lines.push(current)
      }
    }
    return lines
  }, [])

  //+ 生成海报
  const generatePoster = useCallback(async () => {
    if (!isH5 || !canvasRef.current) return
    setGenerating(true)
    setErrorMsg('')
    try {
      //+ 1. 生成二维码 base64（qrcode 库 toDataURL）
      const qrDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 360,
        margin: 2,
        color: { dark: '#1f2329', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      })

      //+ 2. 加载封面图 + 二维码图
      //+ 容错：封面图加载失败不阻塞海报生成，背景留灰色，其他正常
      let coverImg: HTMLImageElement | null = null
      try {
        coverImg = await loadImage(activityCover)
      } catch (err: any) {
        console.warn('[SharePoster] 封面图加载失败:', err?.message)
      }
      const qrImg = await loadImage(qrDataUrl)

      //+ 3. canvas 合成（750 x 1334，移动端海报标准比例）
      //+ 注意：iOS Safari 对 canvas 内存量有上限（约 5MB / 16MB），
      //+ 750x1334 × 4 bytes ≈ 4MB，安全；不要随意放大尺寸
      const canvas = canvasRef.current
      canvas.width = 750
      canvas.height = 1334
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas 2D context 不支持')

      //+ 背景图（封面图撑满，cover 模式）
      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(0, 0, 750, 1334)
      if (coverImg) {
        try {
          const cw = coverImg.width || 750
          const ch = coverImg.height || 1334
          const scale = Math.max(750 / cw, 700 / ch)
          const dw = cw * scale
          const dh = ch * scale
          const dx = (750 - dw) / 2
          const dy = 0
          ctx.drawImage(coverImg, dx, dy, dw, dh)
        } catch (err: any) {
          //+ drawImage 失败兜底：背景留灰，不阻塞后续绘制
          console.warn('[SharePoster] drawImage 封面图失败:', err?.message)
        }
      }

      //+ 4. 底部白色信息卡（标题 + 二维码区域）
      const cardTop = 760
      const cardHeight = 574
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, cardTop, 750, cardHeight)

      //+ 5. 标题（自动换行，最多 2 行）
      ctx.fillStyle = '#1f2329'
      ctx.font = 'bold 40px sans-serif'
      ctx.textBaseline = 'top'
      const titleLines = wrapText(ctx, activityTitle || '活动详情', 670, 2)
      titleLines.forEach((line, i) => {
        ctx.fillText(line, 40, cardTop + 50 + i * 56)
      })

      //+ 6. 副标题：扫码查看活动详情
      ctx.fillStyle = '#86909c'
      ctx.font = '28px sans-serif'
      ctx.fillText('长按识别二维码 查看活动详情', 40, cardTop + 180)

      //+ 7. 二维码（右下角）
      const qrSize = 280
      const qrX = 750 - qrSize - 40
      const qrY = cardTop + 250
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20)
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

      //+ 8. 底部品牌区
      ctx.fillStyle = '#1f2329'
      ctx.font = 'bold 32px sans-serif'
      ctx.fillText('途游 · 发现你的下一个活动', 40, qrY + qrSize - 30)

      //+ 9. 输出 base64
      //+ 移动端 toDataURL 可能因内存压力失败，加 try
      let dataUrl: string
      try {
        dataUrl = canvas.toDataURL('image/png')
      } catch (err: any) {
        throw new Error('图片导出失败：' + (err?.message || '未知错误'))
      }
      if (!dataUrl || dataUrl.length < 100) {
        throw new Error('海报生成失败：导出图片为空')
      }
      setPosterDataUrl(dataUrl)
    } catch (err: any) {
      console.error('[SharePoster] 生成失败:', err)
      setErrorMsg(err?.message || '海报生成失败')
    } finally {
      setGenerating(false)
    }
  }, [isH5, shareUrl, activityCover, activityTitle, loadImage, wrapText])

  //+ visible 变 true 时开始生成
  useEffect(() => {
    if (visible && isH5 && !posterDataUrl && !generating) {
      generatePoster()
    }
    if (!visible) {
      //+ 关闭时清空，下次重新生成（标题/封面可能不同）
      setPosterDataUrl('')
      setErrorMsg('')
    }
  }, [visible, isH5, posterDataUrl, generating, generatePoster])

  if (!isH5 || !visible) return null

  return (
    <div className='share-poster-mask'>
      <div className='share-poster-container'>
        <div className='share-poster-header'>
          <span className='share-poster-title'>分享海报</span>
          <div className='share-poster-close' onClick={onClose}>
            <Close  color='#fff' />
          </div>
        </div>

        <div className='share-poster-body'>
          {generating && (
            <div className='share-poster-loading'>海报生成中...</div>
          )}
          {!generating && errorMsg && (
            <div className='share-poster-error'>{errorMsg}</div>
          )}
          {!generating && !errorMsg && posterDataUrl && (
            <>
              <img
                className='share-poster-img'
                src={posterDataUrl}
                alt='活动海报'
              />
              <div className='share-poster-tip'>
                长按图片保存到相册，分享给好友
              </div>
            </>
          )}
        </div>
      </div>

      {/* 隐藏 canvas，仅用于合成 */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}

export default SharePoster
