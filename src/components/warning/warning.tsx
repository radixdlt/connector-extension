import WarningSvg from './warning.svg'
import './warning.scss'

export const Warning = (props: { header: string; subheader?: string }) => (
  <div className="warning-box">
    <img src={WarningSvg} />
    <div>
      <div className="warning-box-header">{props.header}</div>
      {props.subheader && <div>{props.subheader}</div>}
    </div>
  </div>
)
