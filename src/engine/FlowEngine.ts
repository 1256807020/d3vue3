/**
 * FlowEngine — TypeScript 流程引擎核心
 *
 * 设计目标:
 * 1. 类型安全: 所有输入输出强类型约束
 * 2. 事件驱动: 基于观察者模式，前端 D3 渲染 / 后端 WebSocket 均可订阅
 * 3. 状态机: 节点状态转移 + 流程生命周期管理
 * 4. Action 路由: 连线上的 action 标签决定运行时路径选择
 * 5. 可扩展: 审批等待 / 规则引擎 / 自定义节点类型 / 持久化插件
 *
 * 生命周期:
 *   draft → active → [paused] → completed / terminated / rejected
 *
 * 节点状态机:
 *   idle → running → done / error / rejected / timeout
 *   done → running (重跑)
 *   rejected → running / idle (修改重交)
 *   error → running (重试)
 *
 * ## 与前端/Nest.js 配合
 *
 * ### 前端 (Vue3 + D3.js)
 * ```
 * engine.on('nodeChange', ({ node, newStatus }) => renderNodes())
 * engine.on('stepStart',   ({ node })           => animateToken())
 * engine.on('waitingApproval', ({ node })        => showApproveDialog())
 * ```
 *
 * ### 后端 (Nest.js)
 * ```
 * engine.on('nodeChange', ({ node }) => gateway.emit(flowId, node))
 * engine.on('stepComplete', async ({ node }) => await prisma.history.create(...))
 * ```
 *
 * @module engine/FlowEngine
 */

import {
  STORAGE_KEY,
  NODE_TYPES,
  VALID_TRANSITIONS,
  FLOW_STATES,
  DEFAULT_APPROVE_MODE,
  DEFAULT_OPERATOR,
  MAX_EXECUTION_STEPS,
  ACTIONS,
} from './constants'

import type {
  NodeId,
  NodeStatus,
  FlowNode,
  FlowConnection,
  FlowDefinition,
  FlowType,
  FlowStatus,
  FlowContext,
  FlowHistoryEntry,
  ApprovalDecision,
  FlowSnapshot,
  FlowTemplate,
  ApproveMode,
  ActionLabel,
  NodeTypeDef,
} from './types'

// ==================== 事件系统 ====================

/** 事件回调函数类型 */
type EventCallback = (...args: any[]) => void

/**
 * 轻量级事件发射器（观察者模式）
 *
 * 为什么不直接用 Node EventEmitter 或 mitt?
 * - 零依赖，与浏览器/Node.js 双环境兼容
 * - 支持 unsubscribe (返回取消函数)
 *
 * @example
 * const bus = new EventEmitter()
 * const off = bus.on('tick', (n) => console.log(n))
 * bus.emit('tick', 42)
 * off() // 取消订阅
 */
export class EventEmitter {
  private handlers: Record<string, EventCallback[]> = {}

  /** 注册事件监听，返回取消函数 */
  on(event: string, fn: EventCallback): () => void {
    ;(this.handlers[event] = this.handlers[event] || []).push(fn)
    return () => this.off(event, fn)
  }

  /** 移除事件监听 */
  off(event: string, fn: EventCallback): void {
    const h = this.handlers[event]
    if (h) this.handlers[event] = h.filter((f) => f !== fn)
  }

  /** 触发事件 */
  emit(event: string, data?: unknown): void {
    ;(this.handlers[event] || []).forEach((fn) => fn(data))
  }

  /** 移除所有事件（用于重置） */
  removeAllListeners(): void {
    this.handlers = {}
  }
}

// ==================== 引擎核心 ====================

export class FlowEngine extends EventEmitter {
  // ----- 流程定义 -----
  readonly id: string
  type: FlowType
  name: string
  desc: string
  nodes: FlowNode[]
  connections: FlowConnection[]

  // ----- 运行时状态 -----
  flowStatus: FlowStatus = 'draft'
  currentNodeId: NodeId | null = null
  context: FlowContext = {}
  history: FlowHistoryEntry[] = []

  // ----- 审批控制 -----
  /** 是否自动跳过审批等待（演示模式） */
  autoApprove = false
  /** 审批模式: manual(人工) | auto(自动) | semi(半自动) */
  approveMode: ApproveMode = DEFAULT_APPROVE_MODE

  // ----- 内部状态 -----
  /** 审批等待 Promise resolver — 外部调用 approve() 来 resolve */
  private waitResolver: ((value: ApprovalDecision) => void) | null = null
  /** 当前已执行步数（防止无限循环） */
  private stepCount = 0
  /** 每节点已执行的 action 集合（分支探测用） */
  private executedActions: Map<NodeId, Set<ActionLabel>> = new Map()

  /**
   * @param def - 流程定义 JSON（从 localStorage 或数据库加载）
   */
  constructor(def: FlowDefinition) {
    super()

    this.id = def.id || Date.now().toString(36)
    this.type = def.type || 'custom'
    this.name = def.name || '未命名'
    this.desc = def.desc || ''

    // 深拷贝，避免外部修改污染引擎内部
    this.nodes = def.nodes.map((n) => ({
      ...n,
      status: 'idle' as NodeStatus,
      nodeType: n.nodeType || 'start',
    }))

    this.connections = def.connections.map((c) => ({ ...c }))
  }

  // ==================== 类型/常量获取 ====================

  /** 获取节点类型定义 */
  static getNodeType(typeKey: string): NodeTypeDef {
    return NODE_TYPES[typeKey] || NODE_TYPES.start
  }

  /** 获取节点类型定义（实例方法） */
  getNodeTypeDef(node: FlowNode): NodeTypeDef {
    return FlowEngine.getNodeType(node.nodeType)
  }

  // ==================== 节点查询 ====================

  /** 按 ID 查找节点 */
  getNode(id: NodeId): FlowNode | undefined {
    return this.nodes.find((n) => n.id === id)
  }

  /** 获取节点的所有出边 */
  getOutgoingConnections(nodeId: NodeId): FlowConnection[] {
    return this.connections.filter((c) => c.fromNodeId === nodeId)
  }

  /** 获取节点的所有入边 */
  getIncomingConnections(nodeId: NodeId): FlowConnection[] {
    return this.connections.filter((c) => c.toNodeId === nodeId)
  }

  /** 获取节点的所有后继节点 */
  getSuccessors(nodeId: NodeId): FlowNode[] {
    return this.getOutgoingConnections(nodeId)
      .map((c) => this.getNode(c.toNodeId))
      .filter((n): n is FlowNode => n !== undefined)
  }

  /** 获取节点的所有前驱节点 */
  getPredecessors(nodeId: NodeId): FlowNode[] {
    return this.getIncomingConnections(nodeId)
      .map((c) => this.getNode(c.fromNodeId))
      .filter((n): n is FlowNode => n !== undefined)
  }

  // ==================== 拓扑排序 ====================

  /**
   * Kahn 算法拓扑排序
   * 适用的前提: 图为 DAG（有向无环图）。有环时，环内节点排在最后
   * 时间复杂度: O(V+E)，空间复杂度: O(V)
   *
   * @returns 按拓扑顺序排列的节点
   */
  topoSort(): FlowNode[] {
    // 构建邻接表 + 入度表
    const graph: Record<NodeId, NodeId[]> = {}
    const inDegree: Record<NodeId, number> = {}
    this.nodes.forEach((n) => {
      graph[n.id] = []
      inDegree[n.id] = 0
    })
    this.connections.forEach((c) => {
      if (graph[c.fromNodeId]) {
        graph[c.fromNodeId].push(c.toNodeId)
      }
      inDegree[c.toNodeId] = (inDegree[c.toNodeId] || 0) + 1
    })

    // BFS 拓扑排序
    const queue = this.nodes
      .filter((n) => inDegree[n.id] === 0)
      .map((n) => n.id)
    const order: NodeId[] = []

    while (queue.length > 0) {
      const nid = queue.shift()!
      order.push(nid)
      ;(graph[nid] || []).forEach((succ) => {
        inDegree[succ]--
        if (inDegree[succ] === 0) queue.push(succ)
      })
    }

    // 环内节点追加到末尾
    this.nodes.forEach((n) => {
      if (!order.includes(n.id)) order.push(n.id)
    })

    return order
      .map((id) => this.getNode(id))
      .filter((n): n is FlowNode => n !== undefined)
  }

  // ==================== Action 路由 ====================

  /**
   * 根据连线上的 action 标签找到后继节点
   *
   * 路由策略（优先级从高到低）:
   * 1. 审批节点且有多条出线 → 优先探测未走过的"驳回"路径（展示循环）
   * 2. 精确匹配 action 标签
   * 3. 兜底: 优先"通过"路径，其次第一条
   *
   * @param nodeId - 当前节点 ID
   * @param action - 当前执行的 action 标签
   * @returns [后继节点, 连线] 或 [null, null]
   */
  findSuccessorByAction(
    nodeId: NodeId,
    action: ActionLabel
  ): { node: FlowNode | null; conn: FlowConnection | null } {
    const edges = this.getOutgoingConnections(nodeId)
    if (edges.length === 0) return { node: null, conn: null }

    const node = this.getNode(nodeId)
    const visitedActions = this.executedActions.get(nodeId) || new Set()

    // 策略1: 审批节点多出线 → 探测未走过的"驳回"
    if (node && node.nodeType === 'approve' && edges.length > 1) {
      const rejectEdge = edges.find(
        (e) => e.action === ACTIONS.REJECT && !visitedActions.has(ACTIONS.REJECT)
      )
      if (rejectEdge) {
        visitedActions.add(ACTIONS.REJECT)
        this.executedActions.set(nodeId, visitedActions)
        return {
          node: this.getNode(rejectEdge.toNodeId) || null,
          conn: rejectEdge,
        }
      }
    }

    // 策略2: 精确匹配
    const exact = edges.find((e) => e.action === action)
    if (exact) {
      return {
        node: this.getNode(exact.toNodeId) || null,
        conn: exact,
      }
    }

    // 策略3: 兜底 — 优先走"通过"
    const pass = edges.find((e) => e.action === ACTIONS.APPROVE)
    if (pass) {
      return {
        node: this.getNode(pass.toNodeId) || null,
        conn: pass,
      }
    }

    // 最后: 第一条边
    const first = edges[0]
    return {
      node: this.getNode(first.toNodeId) || null,
      conn: first,
    }
  }

  // ==================== 状态管理 ====================

  /**
   * 对节点执行状态转移
   * @returns 是否转移成功
   */
  transitionNode(node: FlowNode, newStatus: NodeStatus): boolean {
    const allowed = VALID_TRANSITIONS[node.status] || []
    if (allowed.includes(newStatus)) {
      const prev = node.status
      node.status = newStatus
      this.emit('nodeChange', { node, prevStatus: prev, newStatus })
      return true
    }
    return false
  }

  /** 对流程执行状态转移 */
  transitionFlow(status: FlowStatus): void {
    // 合法性校验：只允许预定义的流程状态
    if (!FLOW_STATES.includes(status)) {
      this.emit('error', { message: `非法流程状态: ${status}` })
      return
    }
    this.flowStatus = status
    this.emit('flowChange', { status })
  }

  // ==================== 核心执行 ====================

  /**
   * 启动流程
   *
   * 执行流程:
   * 1. 重置所有状态
   * 2. 找到 start 节点
   * 3. 递归执行节点图（自动模式时自动跳过审批等待）
   *
   * @param ctx - 运行时上下文（变量/表单数据）
   * @param mode - 审批模式
   */
  async start(
    ctx: FlowContext = {},
    mode: ApproveMode = 'manual'
  ): Promise<{ done: boolean; history?: FlowHistoryEntry[]; error?: Error }> {
    this.context = ctx
    this.approveMode = mode
    this.autoApprove = mode === 'auto'
    this.nodes.forEach((n) => {
      n.status = 'idle'
    })
    this.history = []
    this.stepCount = 0
    this.executedActions = new Map()

    // 找到起始节点
    const startNode = this.nodes.find(
      (n) => n.nodeType === 'start' || n.name.includes('发起')
    )
    if (!startNode) {
      this.emit('error', { message: '流程缺少起始节点 (start)' })
      return { done: true, error: new Error('流程缺少起始节点') }
    }

    this.currentNodeId = startNode.id
    this.transitionFlow('active')
    this.emit('flowStart', { node: startNode })

    return this.executeNode(startNode)
  }

  /**
   * 递归执行单个节点（状态机驱动）
   *
   * @param node - 当前要执行的节点
   * @returns 执行结果
   */
  private async executeNode(
    node: FlowNode
  ): Promise<{ done: boolean; history?: FlowHistoryEntry[]; error?: Error; terminated?: boolean }> {
    // 防无限循环保护
    this.stepCount++
    if (this.stepCount > MAX_EXECUTION_STEPS) {
      this.transitionFlow('terminated')
      this.emit('error', { message: `流程超过最大步数限制 (${MAX_EXECUTION_STEPS})` })
      return { done: true, error: new Error('流程步数超限') }
    }

    this.transitionNode(node, 'running')
    this.emit('stepStart', { node })

    const typeDef = this.getNodeTypeDef(node)
    const hasActions = (typeDef.actions || []).length > 0

    try {
      let result: ApprovalDecision

      if (hasActions && this.approveMode === 'manual') {
        // 人工审批 — 挂起等待外部调用 approve()
        this.emit('waitingApproval', { node, actions: typeDef.actions })
        result = await this.waitForApproval(node)
      } else {
        // 自动执行 — 默认取第一条 action
        result = {
          action: typeDef.actions[0] || ACTIONS.DONE,
          operator: DEFAULT_OPERATOR,
          opinion: '',
        }
      }

      // === 根据 action 更新节点状态 ===
      switch (result.action) {
        case ACTIONS.APPROVE:
        case ACTIONS.SUBMIT:
        case ACTIONS.RESUBMIT:
        case ACTIONS.TAKE_OVER:
        case ACTIONS.TRANSFER:
          this.transitionNode(node, 'done')
          break

        case ACTIONS.REJECT:
          this.transitionNode(node, 'rejected')
          this.transitionFlow('rejected')
          break

        default:
          this.transitionNode(node, 'done')
      }

      // 记录审计日志
      this.history.push({
        time: Date.now(),
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.nodeType,
        action: result.action,
        operator: result.operator || DEFAULT_OPERATOR,
        opinion: result.opinion || '',
      })

      this.emit('stepComplete', {
        node,
        action: result.action,
        history: this.history,
      })

      // === 跳转到后继 ===
      const { node: successor, conn } = this.findSuccessorByAction(
        node.id,
        result.action
      )

      if (successor && ![ACTIONS.REJECT].includes(result.action as any)) {
        this.currentNodeId = successor.id
        return this.executeNode(successor)
      }

      // === 无后继 — 判断完成/驳回 ===
      if (
        node.nodeType === 'end' ||
        this.getOutgoingConnections(node.id).length === 0
      ) {
        this.transitionFlow('completed')
        this.emit('flowComplete', { history: this.history })
        return { done: true, history: this.history }
      }

      // 驳回 → 尝试找到修改节点
      if (result.action === ACTIONS.REJECT) {
        const modifyNode = this.nodes.find((n) => n.nodeType === 'modify')
        if (modifyNode) {
          this.currentNodeId = modifyNode.id
          this.emit('waitingModification', {
            node: modifyNode,
            reason: result.opinion,
          })
          return {
            done: false,
            nextNode: modifyNode,
            action: ACTIONS.REJECT,
          } as any
        }
        // 无修改节点 → 流程终止
        this.transitionFlow('terminated')
        this.emit('flowTerminated', { reason: '驳回但无修改节点' })
        return { done: true, terminated: true }
      }

      this.transitionFlow('completed')
      return { done: true }
    } catch (err) {
      // 异常处理 — 标记当前节点 error，记录日志，终止流程
      this.transitionNode(node, 'error')
      this.history.push({
        time: Date.now(),
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.nodeType,
        action: 'error',
        operator: DEFAULT_OPERATOR,
        opinion: err instanceof Error ? err.message : String(err),
      })
      this.emit('stepError', { node, error: err })
      this.transitionFlow('terminated')
      return { done: true, error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  /**
   * 等待人工审批 — 返回 Promise，由外部 approve() resolve
   *
   * 前端配合:
   *   engine.on('waitingApproval', ({ node, actions }) => {
   *     showDialog(actions).then(decision => engine.approve(decision))
   *   })
   *
   * 后端配合:
   *   engine.on('waitingApproval', ({ node }) => {
   *     gateway.emit(client, 'waiting', node)
   *   })
   *   // 收到 API 调用时
   *   engine.approve({ action: '通过', operator: '张三', opinion: '同意' })
   */
  private waitForApproval(node: FlowNode): Promise<ApprovalDecision> {
    return new Promise<ApprovalDecision>((resolve) => {
      this.waitResolver = resolve
    })
  }

  /**
   * 人工审批 — 外部 UI 或 API 调用
   *
   * @param decision - 审批决策
   * @param decision.action - 行为: 通过/驳回/转审/重新提交
   * @param decision.operator - 审批人
   * @param decision.opinion - 审批意见
   */
  approve(decision: ApprovalDecision): void {
    if (this.waitResolver) {
      this.waitResolver(decision)
      this.waitResolver = null
    }
  }

  /**
   * 驳回后重新提交
   * 从修改节点重新开始，恢复被拒绝的节点
   */
  async resubmit(
    ctx: FlowContext = {}
  ): Promise<{ done: boolean; error?: Error } | undefined> {
    Object.assign(this.context, ctx)
    const modifyNode = this.nodes.find((n) => n.nodeType === 'modify')
    if (!modifyNode) return

    this.nodes.forEach((n) => {
      if (n.status === 'rejected') n.status = 'idle'
    })
    this.transitionFlow('active')
    this.currentNodeId = modifyNode.id
    return this.executeNode(modifyNode)
  }

  // ==================== 流程控制 ====================

  /** 暂停流程 */
  pause(): void {
    if (this.flowStatus === 'active') this.transitionFlow('paused')
  }

  /** 恢复流程 */
  async resume(): Promise<{ done: boolean; error?: Error } | undefined> {
    if (this.flowStatus === 'paused') {
      this.transitionFlow('active')
      const node = this.getNode(this.currentNodeId!)
      if (node) return this.executeNode(node)
    }
  }

  /** 终止流程（强制） */
  terminate(): void {
    this.transitionFlow('terminated')
    if (this.waitResolver) {
      this.waitResolver({ action: 'timeout', operator: DEFAULT_OPERATOR, opinion: '流程被终止' })
      this.waitResolver = null
    }
  }

  /** 重置流程到初始状态 */
  reset(): void {
    this.flowStatus = 'draft'
    this.nodes.forEach((n) => {
      n.status = 'idle'
    })
    this.currentNodeId = null
    this.history = []
    this.context = {}
    this.stepCount = 0
    this.executedActions = new Map()
    this.waitResolver = null
    this.emit('flowReset')
  }

  // ==================== 序列化 ====================

  /**
   * 导出流程定义 JSON（去除运行时状态）
   * 适用于模板保存/导出到文件
   */
  toJSON(): FlowDefinition {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      desc: this.desc,
      nodes: this.nodes.map((n) => ({
        ...n,
        status: 'idle' as NodeStatus,
        nodeType: n.nodeType || 'start',
      })),
      connections: this.connections.map((c) => ({
        ...c,
        action: c.action || undefined,
      })),
    }
  }

  /**
   * 导出运行时快照（含状态/历史/上下文）
   * 适用于断点续传 / 服务端持久化
   */
  toSnapshot(): FlowSnapshot {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      flowStatus: this.flowStatus,
      currentNodeId: this.currentNodeId,
      nodes: this.nodes.map((n) => ({ ...n })),
      connections: [...this.connections],
      history: [...this.history],
      context: { ...this.context },
      approveMode: this.approveMode,
    }
  }

  /**
   * 从快照恢复引擎状态
   * 适用于从数据库加载运行中的流程实例
   */
  static fromSnapshot(snap: FlowSnapshot): FlowEngine {
    const engine = new FlowEngine({
      id: snap.id,
      type: snap.type,
      name: snap.name,
      desc: '',
      nodes: snap.nodes,
      connections: snap.connections,
    })
    engine.flowStatus = snap.flowStatus
    engine.currentNodeId = snap.currentNodeId
    engine.history = snap.history
    engine.context = snap.context
    engine.approveMode = snap.approveMode
    return engine
  }

  /**
   * 从流程定义创建引擎实例（工厂方法）
   */
  static from(def: FlowDefinition): FlowEngine {
    return new FlowEngine(def)
  }

  // ==================== 持久化 (localStorage / 可替换为数据库) ====================

  /**
   * 保存模板列表到 localStorage
   * 未来可替换为数据库操作（Prisma / TypeORM）
   */
  static saveTemplates(list: FlowTemplate[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch (e) {
      console.error('[FlowEngine] 保存模板失败:', e)
    }
  }

  /** 从 localStorage 加载所有模板 */
  static loadTemplates(): FlowTemplate[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  }

  /**
   * 保存单个模板（upsert）
   * 如果已存在同 ID 模板则更新，否则新增
   */
  static saveTemplate(t: FlowTemplate): FlowTemplate[] {
    const list = this.loadTemplates()
    const idx = list.findIndex((x) => x.id === t.id)
    const now = new Date().toISOString()

    if (idx >= 0) {
      list[idx] = { ...t, updatedAt: now }
    } else {
      list.push({ ...t, createdAt: now, updatedAt: now })
    }

    this.saveTemplates(list)
    return list
  }

  /** 删除指定 ID 的模板，返回更新后的列表 */
  static deleteTemplate(id: string): FlowTemplate[] {
    const list = this.loadTemplates().filter((t) => t.id !== id)
    this.saveTemplates(list)
    return list
  }

  /** 检查模板是否存在 */
  static templateExists(id: string): boolean {
    return this.loadTemplates().some((t) => t.id === id)
  }
}
