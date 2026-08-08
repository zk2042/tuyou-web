import { Swiper, Cell, ConfigProvider, Indicator, SwiperItem, Image } from '@nutui/nutui-react'
import { Video } from '@tarojs/components'
import { useState, useMemo } from 'react'
import './index.less'

interface DetailBannerProps {
  videoUrl?: string
  images?: string[]
}

const indicatorTheme = {
  nutuiIndicatorDotSize: '7px',
  nutuiIndicatorDotActiveSize: '7px',
}

const DetailBanner = (props: DetailBannerProps) => {
  const { videoUrl, images = [] } = props
  const [currentIndicatorIndex, setCurrentIndicatorIndex] = useState(0)

  const contentItems = useMemo(() => {
    if (videoUrl) {
      return [{ type: 'video' as const, url: videoUrl }]
    }
    if (images.length > 0) {
      return images.map(url => ({ type: 'image' as const, url }))
    }
    return []
  }, [videoUrl, images])

  // 统一外层 16:9 盒子
  const renderContent = () => {
    if (contentItems.length === 0) {
      return <div className="banner-empty">暂无内容</div>
    }

    if (contentItems.length === 1) {
      const item = contentItems[0]
      return item.type === 'video' ? (
        //+ 问题3修复：使用 Taro 原生 Video 组件；小程序端自动播放必须静音(muted=true)，同时启用 playsInline 避免iOS全屏劫持
        <Video
          src={item.url}
          autoplay
          loop
          muted
          controls
          showCenterPlayBtn={false}
          showPlayBtn
          className="banner-video"
        />
      ) : (
        <Image src={item.url} className="banner-single-image" />
      )
    }

    return (
      <Swiper
        className="banner-swiper"
        loop
        indicator={
          <Cell className="banner-indicator">
            <ConfigProvider theme={indicatorTheme}>
              <Indicator total={contentItems.length} current={currentIndicatorIndex} />
            </ConfigProvider>
          </Cell>
        }
        onChange={(index) => setCurrentIndicatorIndex(index)}
      >
        {contentItems.map((item, index) => (
          <SwiperItem key={index}>
            <Image src={item.url} className="banner-image" />
          </SwiperItem>
        ))}
      </Swiper>
    )
  }

  return (
    <div className="detail-banner-wrapper">
      <div className="detail-banner-content">
        {renderContent()}
      </div>
    </div>
  )
}

export default DetailBanner