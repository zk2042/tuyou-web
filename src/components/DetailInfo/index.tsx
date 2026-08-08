//+ 详情页顶部信息组件（标题 + 作者 + 关注按钮 + 内容 + 标签 + 操作栏）
//+ Q8：支持点赞/收藏/关注按钮回调（乐观更新由父组件控制 store）
import Avatar from '../Avatar'
import Button from '../Button'
import './index.less'

export interface DetailInfoActionProps {
  /** 关注状态 */
  isFollowed?: boolean
  /** 当前用户是否是作者本人（本人则不显示关注按钮） */
  isSelf?: boolean
  /** 作者用户ID（用于关注按钮） */
  authorId?: string
  /** 点击关注 */
  onToggleFollow?: (authorId: string, nextIsFollowed: boolean) => void

}

export interface DetailInfoProps {
  detail?: any
  actions?: DetailInfoActionProps
}

const DetailInfo: React.FC<DetailInfoProps> = ({ detail, actions }) => {
  const {
    title,
    content,
    avatar,
    author,
    publishTime,
    tags
  } = detail || {}

  const {
 
    isFollowed = false,
    isSelf = false,
    authorId,
    onToggleFollow,
    
  } = actions || {}

  // 作者信息（保证 author?.id 存在，用于关注）
  const effectiveAuthorId = authorId || author?.id
  const nickname = author?.nickname || ''
  const avatarUrl = avatar || author?.avatar || ''

  

  // 关注
  const handleFollowClick = () => {
    if (isSelf || !effectiveAuthorId) return
    onToggleFollow?.(effectiveAuthorId, !isFollowed)
  }

  return (
    <div className="detail-info">
      {/* 标题 */}
      <p className="info-title">
        {title}
      </p>
      {/* 头像+昵称+时间+关注 */}
      <div className="info-header">
        <div className="info-header-left">
          {/* 头像 */}
          <Avatar url={avatarUrl} size="small" />
          <div className="info-header-left-content">
            {/* 昵称 */}
            <span className="nickname">{nickname}</span>
            {/* 时间 */}
            <span className="publish-time">{publishTime?.split('T')[0] || ''}</span>
          </div>
        </div>
        {/* 关注按钮：非本人显示 */}
        {!isSelf && effectiveAuthorId && (
          <Button
            content={isFollowed ? '已关注' : '+ 关注'}
            onClick={handleFollowClick}
            isFollowed={isFollowed}
          />
        )}
      </div>
      {/* 内容 */}
      <p className="info-content">
        {content}
      </p>
      {/* 标签 */}
      <div className="info-tags">
        {tags?.map((tag: string) => (
          <span key={tag} className="tag" onClick={() => { }}>
            <span className="tag-icon">#</span>{tag}
          </span>
        ))}
      </div>


    </div>
  )
}

export default DetailInfo
