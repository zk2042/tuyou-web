//+ 评论点赞数增量比对工具
//+ 用途：轮询拉到远端评论列表后，与本地 store 的 comment.list 比对，
//+       只挑出 likeCount 变化的项，供 reducer 做"最小化 patch"
//+ 设计原则：
//+   1. 只比对 likeCount，不动 content/member/replies 等字段（避免重渲染抖动）
//+   2. 一级评论按 id 对齐，二级评论按 id 对齐（Comment 与 CommentDTO 都用 id 字段）
//+   3. 只输出变化项，未变的不进 patch，保证引用最小化
//+   4. 不在这里做"跳过乐观更新"判断（由 reducer 层用 lastLikedAt 过滤）
import type { Comment } from '@/types/entity'

//+ 比对结果：likeCount 变化的项
//+ - 一级评论：parentId 为 undefined
//+ - 二级评论：parentId 为其父一级评论 id
export interface CommentLikePatch {
  id: string
  parentId?: string
  likeCount: number
}

//+ 比对本地评论树与远端评论树，输出 likeCount 变化的 patch 列表
//+ local: store 当前 comment.list（已加载的一级 + 已加载的二级）
//+ remote: 刚从 GET /comments 拉到并 normalize 后的 Comment[]（自带 replies 前2条）
//+ 注意：getCommentsAPI 已 normalize，remote 也是 Comment[] 类型
export function diffCommentLikes(
  local: Comment[],
  remote: Comment[]
): CommentLikePatch[] {
  const patch: CommentLikePatch[] = []

  //+ 本地一级评论按 id 建索引，O(1) 查找
  const localIndex = new Map<string, Comment>()
  for (const c of local) {
    localIndex.set(c.id, c)
  }

  for (const r of remote) {
    const localComment = localIndex.get(r.id)
    if (!localComment) continue  //+ 远端有、本地没有（新增评论）→ 不处理，由下次 fetchComments 全量同步

    //+ 一级评论 likeCount 比对
    if (localComment.likeCount !== r.likeCount) {
      patch.push({ id: r.id, likeCount: r.likeCount })
    }

    //+ 二级评论比对：远端 replies（前2条）vs 本地 comment.replies
    const remoteReplies = r.replies
    const localReplies = localComment.replies
    if (Array.isArray(remoteReplies) && Array.isArray(localReplies) && remoteReplies.length > 0) {
      //+ 本地二级按 id 建索引
      const localReplyIndex = new Map<string, Comment>()
      for (const lr of localReplies) {
        localReplyIndex.set(lr.id, lr)
      }
      for (const rr of remoteReplies) {
        const localReply = localReplyIndex.get(rr.id)
        if (!localReply) continue  //+ 本地没加载这条二级（超过前2条）→ 跳过
        if (localReply.likeCount !== rr.likeCount) {
          patch.push({ id: rr.id, parentId: r.id, likeCount: rr.likeCount })
        }
      }
    }
  }

  return patch
}
