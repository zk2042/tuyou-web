//+ 用户模块Mock数据和路由
//+ 用户分两类：member=普通会员，leader=领队
import { randomInt, randomItem, successResponse, errorResponse } from './utils'

//+ 昵称前缀和后缀（会员）
const memberNicknamePrefixes = ['山林', '背包', '追风', '游侠', '行者', '旅人', '行者', '背包客', '探索', '自由']
const memberNicknameSuffixes = ['旅人', '爱好者', '行者', '游侠', '发烧友', '玩家', '冒险家', '挑战者', '追光者', '远方客']

//+ 领队专属昵称
const leaderNicknamePrefixes = ['登山领队', '露营导师', '骑行领队', '徒步向导', '攀岩教练', '溯溪领队', '自驾游领队', '跑步教练']
const leaderNicknameSuffixes = ['老王', '小张', '阿强', '大雄', '老驴', '大牛', '阿飞', '小军', '老K', '阿山']

//+ 用户签名
const memberBios = [
  '热爱户外，享受自然',
  '每周一山，挑战自我',
  '用脚步丈量世界',
  '户外摄影爱好者',
  '徒步是一种生活方式',
  '喜欢大自然的每一个角落',
  '跟着领队去冒险',
  '户外新手，持续学习中',
  '周末一起出发吧',
  '旅行是最好的老师'
]

//+ 领队签名
const leaderBios = [
  '资深户外领队，八年带队经验',
  '中国登山协会认证领队',
  '擅长高海拔攀登和野外生存',
  'LNT无痕山林讲师',
  '红十字会急救员',
  '户外装备测评达人',
  '专业领队，安全第一',
  '十年户外经验，带你看世界',
  '徒步/露营/登山全能领队',
  '热爱分享，带领大家探索自然'
]

//+ 生成会员用户（30人）
export const mockUsers = Array.from({ length: 30 }, (_, i) => {
  const id = i + 1
  const prefix = randomItem(memberNicknamePrefixes)
  const suffix = randomItem(memberNicknameSuffixes)

  return {
    id: String(id),
    phone: `1${randomInt(3, 9)}${String(randomInt(100000000, 999999999))}`,
    nickname: `${prefix}${suffix}`,
    avatar: `https://picsum.photos/seed/member${id}/100/100`,
    bio: randomItem(memberBios),
    bgImg: '',
    memberType: 1,
    publishCount: randomInt(0, 5),
    followCount: randomInt(0, 100),
    fansCount: randomInt(0, 50),
    role: 'member' as const
  }
})

//+ 生成领队用户（20人，ID从31开始，避免与会员ID冲突）
export const mockLeaders = Array.from({ length: 20 }, (_, i) => {
  const id = i + 31
  const prefix = randomItem(leaderNicknamePrefixes)
  const suffix = randomItem(leaderNicknameSuffixes)

  return {
    id: String(id),
    phone: `1${randomInt(3, 9)}${String(randomInt(100000000, 999999999))}`,
    nickname: `${prefix}${suffix}`,
    avatar: `https://picsum.photos/seed/leader${id}/100/100`,
    bio: randomItem(leaderBios),
    bgImg: '',
    memberType: 2,
    publishCount: randomInt(5, 30),
    followCount: randomInt(50, 500),
    fansCount: randomInt(100, 2000),
    role: 'leader' as const
  }
})

//+ 存储已发送的验证码，key=phone，value={code, scene, expires, verified}
const codeStore: Record<string, { code: string; scene: string; expires: number; verified: boolean }> = {}

//+ 生成6位数字验证码
function generateCode(): string {
  return String(randomInt(100000, 999999))
}

//+ Mock路由映射：用户模块
export const userMockRoutes: Record<string, (data?: any, url?: string) => any> = {
  //+ 健康检查
  'GET /api/v1/health': () => successResponse({}),

  //+ ========== 认证模块 ==========

  //+ 发送验证码
  'POST /api/v1/auth/send-code': (data) => {
    const { phone, scene } = data || {}
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return errorResponse('手机号格式无效', 400)
    }
    if (!['register', 'login', 'reset-password'].includes(scene)) {
      return errorResponse('scene 参数不合法', 400)
    }

    //+ 检查频率限制：60秒内不可重复发送
    const existing = codeStore[phone]
    if (existing && Date.now() - existing.expires < 4 * 60 * 1000) {
      return errorResponse('发送频率超限，请60秒后重试', 429)
    }

    const code = generateCode()
    codeStore[phone] = {
      code,
      scene,
      expires: Date.now() + 5 * 60 * 1000,
      verified: false
    }

    console.log(`[Mock] 验证码已发送 → phone: ${phone}, code: ${code}, scene: ${scene}`)
    return successResponse({ message: '验证码已发送' })
  },

  //+ 用户登录（密码登录 + 验证码登录）
  'POST /api/v1/auth/login': (data) => {
    const { phone, password: _password, code, type } = data || {}
    //+ 从会员+领队中查找
    const user = [...mockUsers, ...mockLeaders].find(u => u.phone === phone)

    //+ 验证码登录
    if (type === 'code') {
      if (!phone || !code) {
        return errorResponse('请填写手机号和验证码')
      }
      const stored = codeStore[phone]
      if (!stored || stored.code !== code) {
        return errorResponse('验证码错误')
      }
      if (Date.now() > stored.expires) {
        return errorResponse('验证码已过期')
      }
      if (stored.scene !== 'login') {
        return errorResponse('验证码场景不匹配')
      }
      stored.verified = true
      if (!user) {
        return errorResponse('手机号未注册，请先前往注册', 400)
      }
      return successResponse({
        token: 'mock-jwt-token-' + Date.now(),
        member: {
          id: user.id,
          nickname: user.nickname,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role || 'member'
        }
      })
    }

    //+ 密码登录（默认）
    if (user && data?.password) {
      return successResponse({
        token: 'mock-jwt-token-' + Date.now(),
        member: {
          id: user.id,
          nickname: user.nickname,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role || 'member'
        }
      })
    }
    return errorResponse('手机号或密码错误')
  },

  //+ 用户注册
  'POST /api/v1/auth/register': (data) => {
    const { phone, code, nickname, password, confirmPassword } = data || {}

    if (!phone || !code || !nickname || !password || !confirmPassword) {
      return errorResponse('注册信息不完整')
    }
    if (password !== confirmPassword) {
      return errorResponse('两次输入的密码不一致')
    }

    //+ 验证码校验
    const stored = codeStore[phone]
    if (!stored || stored.code !== code) {
      return errorResponse('验证码错误')
    }
    if (Date.now() > stored.expires) {
      return errorResponse('验证码已过期')
    }
    if (stored.scene !== 'register') {
      return errorResponse('验证码场景不匹配')
    }
    stored.verified = true

    //+ 检查手机号是否已注册
    if ([...mockUsers, ...mockLeaders].find(u => u.phone === phone)) {
      return errorResponse('该手机号已注册')
    }

    const newUser = {
      id: String(mockUsers.length + mockLeaders.length + 1),
      phone,
      nickname,
      avatar: '',
      bio: '',
      bgImg: '',
      memberType: 1,
      publishCount: 0,
      followCount: 0,
      fansCount: 0,
      role: 'member' as const
    }
    mockUsers.push(newUser)
    return successResponse({
      token: 'mock-jwt-token-' + Date.now(),
      member: {
        id: newUser.id,
        nickname: newUser.nickname,
        phone: newUser.phone,
        avatar: newUser.avatar,
        role: 'member'
      }
    })
  },

  //+ 重置密码
  'POST /api/v1/auth/reset-password': (data) => {
    const { phone, code, newPassword, confirmPassword } = data || {}

    if (!phone || !code || !newPassword || !confirmPassword) {
      return errorResponse('请填写完整信息')
    }
    if (newPassword !== confirmPassword) {
      return errorResponse('两次输入的密码不一致')
    }

    const user = [...mockUsers, ...mockLeaders].find(u => u.phone === phone)
    if (!user) {
      return errorResponse('该手机号未注册')
    }

    //+ 验证码校验
    const stored = codeStore[phone]
    if (!stored || stored.code !== code) {
      return errorResponse('验证码错误')
    }
    if (Date.now() > stored.expires) {
      return errorResponse('验证码已过期')
    }
    if (stored.scene !== 'reset-password') {
      return errorResponse('验证码场景不匹配')
    }
    stored.verified = true

    return successResponse({ message: '密码重置成功' })
  },

  //+ ========== 用户模块 ==========

  //+ 获取当前用户信息（默认返回一个会员用户）
  'GET /api/v1/user/profile': () => successResponse(mockUsers[0]),

  //+ 获取用户基础信息（通用接口 /member/info，含 role 字段）
  //+ 默认模拟当前登录用户为领队（mockLeaders[0]），便于发布活动按钮测试
  'GET /api/v1/member/info': () => {
    const me = mockLeaders[0]
    return successResponse({
      id: me.id,
      nickname: me.nickname,
      avatar: me.avatar,
      role: '领队'
    })
  },

  //+ 更新用户资料
  'PUT /api/v1/user/profile': (data) => ({
    code: 0,
    message: '成功',
    data: {
      ...mockUsers[0],
      ...data
    }
  }),

  //+ 更新用户设置
  'PUT /api/v1/user/settings': () => successResponse({}),

  //+ 获取指定用户公开资料
  'GET /api/v1/users/:userId': (_, url) => {
    const userId = (url as string).split('/').pop() || '1'
    const user = [...mockUsers, ...mockLeaders].find(u => u.id === userId)
    if (user) {
      return successResponse({
        ...user,
        isFollowed: false
      })
    }
    return errorResponse('用户不存在')
  },

  //+ 退出登录
  'POST /api/v1/auth/logout': () => successResponse({ message: '已退出登录' }),

  //+ ========== 关注模块 ==========

  //+ 关注/取消关注（切换式，返回最新关注状态 & 对方粉丝数变化）
  'POST /api/v1/members/:id/follow': (_, url) => {
    const id = (url as string).split('/')[2] || '1'
    const user = [...mockUsers, ...mockLeaders].find(u => u.id === id)
    if (!user) return errorResponse('用户不存在')
    // 本地临时 map 存每个用户的关注状态
    const FOLLOW_STORE_KEY = '__followed_users__'
    const store: Record<string, boolean> = (globalThis as any)[FOLLOW_STORE_KEY] || {}
    const prev = !!store[id]
    store[id] = !prev
    ;(globalThis as any)[FOLLOW_STORE_KEY] = store
    return successResponse({
      memberId: id,
      isFollowed: store[id],
      followCount: (Number(user.followCount || 0) + (store[id] ? 1 : -1))
    })
  }
}
