import {Input,Popup,Cell,Toast,Button,Form,TextArea} from '@nutui/nutui-react'
import {useState,useRef} from 'react'
import { IconFont } from '@nutui/icons-react'
import '@/assets/iconfont.css'
import './index.less'
interface CommentInputActionProps{
    
  /** 点赞状态 */
  isLiked?: boolean
  /** 点赞数 */
  likeCount?: number
  /** 收藏状态 */
  isFavorited?: boolean
  /** 收藏数（后端未返回则不传） */
  favoriteCount?: number
/** 点击点赞 */
  onToggleLike?: (nextIsLiked: boolean) => void
  /** 点击收藏 */
  onToggleFavorite?: (nextIsFavorited: boolean) => void

}
export interface CommentInputProps {
  detail?: any
  actions?: CommentInputActionProps
}

const CommentInput:React.FC<CommentInputProps> = ({detail,actions})=>{
//      const {
//     title,
//     content,
//     avatar,
//     author,
//     publishTime,
//     tags
//   } = detail || {}

  const {
    isLiked = false,
    likeCount = 0,
    isFavorited = false,
    favoriteCount ,
    onToggleLike,
    onToggleFavorite
  } = actions || {}
    // 点赞
//   const handleLikeClick = () => {
    
//     onToggleLike?.(!isLiked)
//   }

  // 收藏
//   const handleFavoriteClick = () => {
//     onToggleFavorite?.(!isFavorited)
//   }
    const [visible,setVisible] = useState<boolean>(false)
    // const [isLiked,setIsLiked] = useState<boolean>(false)
    // const [likeCount,setLikeCount] = useState<number>(0)
    // const [isFavorite,setIsFavorite] = useState<boolean>(false)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [textareaValue,setTextareaValue] = useState<string>('')

    const handleSend = () => {
        const content = textareaValue.trim()
        if (!content) return
        Toast.show({ content: '评论已发送', duration: 1 })
        setTextareaValue('')
        setVisible(false)
    }


    
  // 处理图标点击，阻止冒泡
  const handleIconClick = (e: any, action: string) => {
    e.stopPropagation() // 阻止事件冒泡到 Cell
    
    switch(action) {
      case 'like':
        {
            //  if(isLiked){
            //     setIsLiked(false)
            //     setLikeCount(likeCount - 1)
            //     Toast.show({ content: '取消点赞', duration: 1 })
            //  }else{
            //     setIsLiked(true)
            //     setLikeCount(likeCount + 1)
            //     Toast.show({ content: '已点赞', duration: 1 })
            //  }
           
            onToggleLike?.(!isLiked)
             break
        }
       
      case 'favorite':
        {
            //  if(isFavorite){
            //     setIsFavorite(false)
            //     Toast.show({ content: '取消收藏', duration: 1 })
            //  }else{
            //     setIsFavorite(true)
            //     Toast.show({ content: '已收藏', duration: 1 })
            //  }
             onToggleFavorite?.(!isFavorited)
             break
        }
      case 'share':
        Toast.show({ content: '禁止转发', duration: 1 })
        break
    }
  }
    
    return (
        <div className='comment-input-container'>
   
                <Cell title="评论内容" onClick={()=>setVisible(true)} className='comment-input-cell'>
                    {/* 无效输入框 */}
                    <Input placeholder="写评论..." className='comment-input'  readOnly />
                    {/* 点赞 */}

                    <IconFont name={isLiked ? 'likefill' : 'like'} fontClassName="iconfont" classPrefix="icon" className={isLiked ? 'like-active' : ''} onClick={(e) => handleIconClick(e,'like')}><span className='like-count'>{likeCount}</span></IconFont>
                    {/* 收藏 */}
                    <IconFont name={isFavorited ? 'shoucangfill' : 'shoucang'} fontClassName="iconfont" classPrefix="icon" className={isFavorited ? 'favorite-active' : ''} onClick={(e) => handleIconClick(e,'favorite')} />
                    {/* 转发 */}
                    <IconFont name="zhuanfa" fontClassName="iconfont" classPrefix="icon" onClick={(e) => handleIconClick(e,'share')} />

                </Cell>

                <Popup  
                    visible={visible} 
                    onClose={()=>setVisible(false)}
                    duration={200}
                    position="bottom"

                    >
                    <Form>
                        
                        <Form.Item name="content" className="form-item">
                            <TextArea
                             maxLength={3000}
                             rows={1}
                             autoSize={true}
                             ref={textareaRef}
                             placeholder="写评论..."
                             onChange={(val) => setTextareaValue(val as string)} />
                        </Form.Item>
                       <Form.Item className="form-item">
                            <Button
                                className={textareaValue.trim() ? 'btn-active' : ''}
                                disabled={!textareaValue.trim()}
                                onClick={handleSend}
                            >
                                发送
                            </Button>
                        </Form.Item>
                    </Form>
                    
                </Popup>
                {/* <Popup  
                    visible={visible} 
                    onClose={()=>setVisible(false)}
                    duration={200}
                    position="bottom"
                    closeable={true}
                    closeIconPosition='top-right'

                    >

                    <Input placeholder="请输入评论内容" />
                    <Button onClick={()=>setVisible(false)}>发布</Button>
                </Popup> */}
        


            
        </div>
        
    )
}
export default CommentInput

