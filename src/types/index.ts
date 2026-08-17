//+ 公共类型 barrel 导出（types 模块化入口）
//+ 调用方保持 `import type { X } from '@/types'` 不变。
//+ 如需要定位具体定义，可改用：
//+   import type { User } from '@/types/entity'
//+   import type { PageResult, ProfileUpdate, UserRole } from '@/types/api'
//+   import type { UploadType } from '@/types/upload'

//+ 业务实体
export type {
  User,
  UserPublic,
  Post,
  FeedItem,
  SlideItem,
  ActivityBanner,
  Activity,
  ActivityListItem,
  Comment,
  InteractionMessage,
  SystemMessage,
  ProfilePostItem,
  FollowItem,
  FanItem,
  Tag
} from './entity'

//+ API 协议域（枚举/常量/分页/请求DTO/统一响应）
export {
  type UserRole,
  CATEGORY_MAP,
  getCategoryName,
  COMMENT_TARGET_TYPE
} from './api'

export type {
  PageResult,
  ActivityListResult,
  ProfileInfo,
  ProfileUpdate,
  ApiResponse,
  CommentUserDTO,
  CommentDTO,
  CommentListResult,
  CreateCommentParams,
  CommentQueryParams,
  CommentRepliesQueryParams,
  MessageSenderDTO,
  MessageDTO,
  MessageCommentDTO,
  MessageReplyDTO,
  MessageListResult,
  UnreadCountResult,
  MessageReplyResult,
  MarkAllReadResult
} from './api'

//+ 上传专项
export type { UploadType } from './upload'
