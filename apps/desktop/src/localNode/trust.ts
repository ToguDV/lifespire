import { APP_HOST, APP_SCHEME } from '../protocol'

export interface IpcSenderState {
  senderIsMainWindow: boolean
  frameIsMainFrame: boolean
  frameUrl: string | null | undefined
}

/** IPC is only accepted from the main window's top frame on the app origin. */
export function isTrustedIpcSender(
  state: IpcSenderState,
  policy: { isPackaged: boolean; devUrl: string },
): boolean {
  if (!state.senderIsMainWindow || !state.frameIsMainFrame) return false
  const frameUrl = state.frameUrl
  if (!frameUrl) return false
  let url: URL
  try {
    url = new URL(frameUrl)
  } catch {
    return false
  }
  if (policy.isPackaged) return url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST
  try {
    return url.origin === new URL(policy.devUrl).origin
  } catch {
    return false
  }
}
