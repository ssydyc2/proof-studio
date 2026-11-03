export type ToolId = 'tex' | 'lean'

export type ToolStatus = {
  id: ToolId
  label: string
  ready: boolean
  detail: string
  hint: string
}
