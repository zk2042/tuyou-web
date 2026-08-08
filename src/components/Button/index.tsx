import {Button as NutuiButton} from '@nutui/nutui-react'
import './index.less'

const Button=({content,onClick,isFollowed}:{content:string,onClick:()=>void,isFollowed:boolean})=>{
    return (
        <NutuiButton className={`nutui-button ${ isFollowed ? 'disabled' : ''}`} onClick={onClick}>{content}</NutuiButton>
    )
}
export default Button