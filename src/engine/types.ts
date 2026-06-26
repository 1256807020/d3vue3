/**
 * FlowEngine 类型定义
 * 集中管理所有接口、类型别名和枚举，确保类型安全
 */

// ==================== 基础类型 ====================

/** 节点 ID */
export type NodeId = number

/** 连线 ID */
export type ConnId = number

/** 流程实例 ID */
export type FlowId = string

/** 操作行为标签 */
export type ActionLabel = string

// ==================== 端口与布局 ====================

/** 节点端口方向 */
export type PortDirection = 'top' | 'right' | 'bottom' | 'left'

/** 端口坐标 */
export interface PortPosition {
  x: number
  y: number
}

// ==================== 节点定义 ====================

/** 节点形状 */
export type NodeShape = 'rounded' | 'diamond' | 'circle'

/** 节点类型注册条目 */
export interface NodeTypeDef {
  label: string
  color: string
  shape: NodeShape
  actions: ActionLabel[]
  canLoop: boolean
  desc: string
  icon?: string
}

/** 节点类型表 */
export type NodeTypeRegistry = Record<string, NodeTypeDef>

/** 节点状态 */
export type NodeStatus = 'idle' | 'running' | 'done' | 'error' | 'rejected' | 'timeout'

/** 流程节点数据 */
export interface FlowNode {
  id: NodeId
  x: number
  y: number
  width: number
  height: number
  name: string
  desc: string
  cmd: string
  color: string
  nodeType: string
  status: NodeStatus
}

// ==================== 连线定义 ====================

/** 流程连线数据 */
export interface FlowConnection {
  id: ConnId
  fromNodeId: NodeId
  fromPort: PortDirection
  toNodeId: NodeId
  toPort: PortDirection
  /** 可选条件标签，如"通过"/"驳回"/"转审" */
  action?: ActionLabel
}

// ==================== 流程定义 ====================

/** 流程类型 */
export type FlowType = 'cicd' | 'approval' | 'release' | 'custom'

/** 流程状态 */
export type FlowStatus = 'draft' | 'active' | 'paused' | 'completed' | 'terminated' | 'rejected'

/** 流程定义 JSON */
export interface FlowDefinition {
  id?: FlowId
  type: FlowType
  name: string
  desc: string
  nodes: FlowNode[]
  connections: FlowConnection[]
}

/** 审批模式 */
export type ApproveMode = 'manual' | 'auto' | 'semi'

// ==================== 运行时类型 ====================

/** 运行时变量上下文 */
export type FlowContext = Record<string, unknown>

/** 流转历史记录 */
export interface FlowHistoryEntry {
  time: number
  nodeId: NodeId
  nodeName: string
  nodeType: string
  action: string
  operator: string
  opinion: string
}

/** 审批决策 */
export interface ApprovalDecision {
  action: ActionLabel
  operator: string
  opinion: string
}

/** 流程运行时快照 */
export interface FlowSnapshot {
  id: FlowId
  type: FlowType
  name: string
  flowStatus: FlowStatus
  currentNodeId: number | null
  nodes: FlowNode[]
  connections: FlowConnection[]
  history: FlowHistoryEntry[]
  context: FlowContext
  approveMode: ApproveMode
}

// ==================== 模板持久化 ====================

/** 持久化模板（含时间戳） */
export interface FlowTemplate extends FlowDefinition {
  id: FlowId
  type: FlowType
  createdAt?: string
  updatedAt?: string
}

// ==================== 优化端口 ====================

/** 端口组合评分结果 */
export interface PortScore {
  score: number
  fromPort: PortDirection
  toPort: PortDirection
}

// ==================== 图结构 ====================

/** 邻接表 */
export type AdjacencyList = Record<NodeId, NodeId[]>

/** 入度表 */
export type InDegreeMap = Record<NodeId, number>

// ==================== 状态转换 ====================

/** 节点状态转移规则表 */
export type NodeTransitionMap = Record<NodeStatus, NodeStatus[]>

// ==================== 流程类型模板 ====================

/** 流程类型默认节点定义 */
export interface DefaultNodeDef {
  name: string
  desc: string
  cmd: string
  nodeType: string
}

/** 流程类型注册条目 */
export interface EngineTypeDef {
  label: string
  color: string
  icon: string
  desc: string
  defaultNodes: DefaultNodeDef[]
}

/** 流程类型注册表 */
export type EngineTypeRegistry = Record<FlowType, EngineTypeDef>
