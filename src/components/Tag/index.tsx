import {Tag as NutuiTagComponent} from '@nutui/nutui-react'
import './index.less'

const Tag=(props)=>{
    return (
        <NutuiTagComponent className="tag">{props.tagName}</NutuiTagComponent>
    )
}
export default Tag