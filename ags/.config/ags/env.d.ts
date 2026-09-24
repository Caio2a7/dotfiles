declare const SRC: string

declare module "inline:*" {
  const content: string
  export default content
}

declare module "*.scss" {
  const content: string
  export default content
}

declare module "*.blp" {
  const content: string
  export default content
}

declare module "*.css" {
  const content: string
  export default content
}

declare module "gi://AstalBattery" {
  namespace Battery {
    type Battery = any
  }
  const Battery: any
  export default Battery
}

declare module "gi://AstalNetwork" {
  namespace Network {
    type Network = any
    enum Primary {
      UNKNOWN = 0,
      WIRED = 1,
      WIFI = 2,
    }
  }
  const Network: any & {
    get_default(): any
    Primary: typeof Network.Primary
  }
  export default Network
}

declare module "gi://AstalHyprland" {
  namespace Hyprland {
    type Hyprland = any
    type Client = any
    type Workspace = any
    type Monitor = any
  }
  const Hyprland: any
  export default Hyprland
}

declare module "gi://AstalWp" {
  const Wp: any
  export default Wp
}

declare module "gi://AstalMpris" {
  const Mpris: any
  export default Mpris
}
