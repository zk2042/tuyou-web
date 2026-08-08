import {Avatar as NutuiAvatar} from '@nutui/nutui-react'
import './index.less'

const Avatar = ({url,size}:{url:string,size:string}) => {
  return (
    <NutuiAvatar
      src={url}
      fit="cover"
      size={size}
         />
  )
}
export default Avatar

