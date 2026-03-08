import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

export default ((component?: QuartzComponent) => {
  if (component) {
    const Component = component
    const NotDesktop: QuartzComponent = (props: QuartzComponentProps) => {
      return <Component displayClass="not-desktop" {...props} />
    }

    NotDesktop.displayName = component.displayName
    NotDesktop.afterDOMLoaded = component?.afterDOMLoaded
    NotDesktop.beforeDOMLoaded = component?.beforeDOMLoaded
    NotDesktop.css = component?.css
    return NotDesktop
  } else {
    return () => <></>
  }
}) satisfies QuartzComponentConstructor
