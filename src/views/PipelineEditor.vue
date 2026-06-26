<template>
  <!--
    流程编排器 - Pipeline Editor
    基于 D3.js 的可视化 CI/CD 流程编排工具
    功能：网格拖拽、四向端口、正交连线、流程执行动画
  -->
  <div class="pipeline-page">
    <!-- ==================== 顶部工具栏 ==================== -->
    <div class="pipeline-toolbar">
      <div class="toolbar-left">
        <el-button size="small" text @click="$router.push('/flow')">
          <el-icon><ArrowLeft /></el-icon> 模板列表
        </el-button>
        <span class="toolbar-title">{{ currentTemplate ? currentTemplate.name + ' — 流程编排' : '流程编排' }}</span>
        <span v-if="currentTemplate" class="toolbar-type-tag" :style="{background: getTypeInfo(currentTemplate.type).color}">
          {{ getTypeInfo(currentTemplate.type).label }}
        </span>
        <el-divider direction="vertical" />

        <!-- 画布操作按钮 -->
        <el-button type="primary" size="small" @click="addNode">
          <el-icon style="margin-right:4px"><Plus /></el-icon>添加步骤
        </el-button>

        <!-- 流程执行控制 -->
        <el-button type="success" size="small" :disabled="isRunning" @click="startFlowExecution">
          <el-icon style="margin-right:4px"><VideoPlay /></el-icon>运行流程
        </el-button>
        <el-button size="small" :disabled="!isRunning" @click="stopFlowExecution">
          <el-icon style="margin-right:4px"><VideoPause /></el-icon>停止
        </el-button>
        <el-button size="small" :disabled="!isRunning" @click="resetFlowExecution" type="warning">
          重置
        </el-button>

        <el-divider direction="vertical" />

        <!-- 视图控制 -->
        <el-button size="small" @click="fitToContent" title="自动缩放到适合所有节点">
          <el-icon style="margin-right:4px"><FullScreen /></el-icon>适应内容
        </el-button>
        <el-button size="small" @click="resetView" title="重置为默认视图">
          <el-icon style="margin-right:4px"><RefreshLeft /></el-icon>重置视图
        </el-button>
        <span class="zoom-indicator">{{ zoomPercent }}%</span>

        <el-divider direction="vertical" />

        <!-- 数据操作按钮 -->
        <el-button size="small" @click="exportFlow">导出 JSON</el-button>
        <el-button size="small" @click="importFlow">导入 JSON</el-button>
        <el-button size="small" type="success" @click="saveLayout" :disabled="!currentTemplate">
          <el-icon style="margin-right:4px"><Plus /></el-icon>保存布局
        </el-button>
        <el-button size="small" type="danger" @click="clearAll">清空画布</el-button>
      </div>
      <div class="toolbar-right">
        <span class="execution-log" v-if="executionLog">{{ executionLog }}</span>
        <el-tooltip v-else placement="bottom" effect="dark" raw-content
          content="拖拽移动节点 | 双击编辑 | 四向端口拖拽连线<br/>右键删除 | 拖拽空白平移画布 | 滚轮缩放">
          <el-button size="small" text class="hint-btn">
            <el-icon><InfoFilled /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- ==================== D3 SVG 画布 ==================== -->
    <div class="pipeline-canvas" ref="canvasRef">
      <svg ref="svgRef" width="100%" height="100%"></svg>
    </div>

    <!-- ==================== 节点编辑弹窗 ==================== -->
    <el-dialog v-model="editDialogVisible" title="编辑步骤" width="480px" :close-on-click-modal="false">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="步骤名称">
          <el-input v-model="editForm.name" placeholder="如: Git 拉取代码" maxlength="20" show-word-limit />
        </el-form-item>
        <el-form-item label="描述信息">
          <el-input v-model="editForm.desc" type="textarea" :rows="3" placeholder="如: 从代码仓库拉取最新代码" />
        </el-form-item>
        <el-form-item label="执行命令">
          <el-input v-model="editForm.cmd" type="textarea" :rows="2" placeholder="如: git pull origin main" />
        </el-form-item>
        <el-form-item label="节点类型">
          <el-select v-model="editForm.nodeType" style="width:100%">
            <el-option
              v-for="(info, key) in NODE_TYPES"
              :key="key" :label="info.label" :value="key"
            >
              <span :style="{color:info.color,fontWeight:600}">●</span> {{ info.label }} — {{ info.desc }}
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="节点颜色">
          <el-color-picker v-model="editForm.color" show-alpha />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">确认保存</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 导出 JSON 弹窗 ==================== -->
    <el-dialog v-model="exportDialogVisible" title="导出流程 JSON" width="600px">
      <el-input v-model="exportJson" type="textarea" :rows="15" readonly />
      <template #footer>
        <el-button @click="copyExportJson">复制到剪贴板</el-button>
        <el-button type="primary" @click="exportDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 导入 JSON 弹窗 ==================== -->
    <el-dialog v-model="importDialogVisible" title="导入流程 JSON" width="600px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px">
        <template #title>粘贴之前导出的流程 JSON，需要包含 <b>nodes</b> 和 <b>connections</b> 字段</template>
      </el-alert>
      <el-input v-model="importJson" type="textarea" :rows="14" placeholder="在此粘贴 JSON..." />
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doImportJson" :disabled="!importJson.trim()">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * PipelineEditor.vue - D3.js 可视化流程编排器
 *
 * 核心能力：
 * 1. 网格背景 — 20px 小圆点 + 100px 大虚线双层网格
 * 2. 可拖拽节点 — 蓝色圆角矩形，自动吸附网格，支持上/下/左/右四向端口
 * 3. 正交连线 — 曼哈顿路径（横平竖直），带 SVG 箭头标记
 * 4. 端口拖拽连线 — 从任意端口拖出虚线，松手到目标节点自动创建连线
 * 5. 流程执行模拟 — JS 数组模拟任务链，D3 动画展示执行进度
 * 6. 导入导出 — JSON 格式持久化流程数据
 */

import { ref, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as d3 from 'd3'
import { ElMessage } from 'element-plus'
import { Plus, VideoPlay, VideoPause, ArrowLeft, FullScreen, RefreshLeft, InfoFilled } from '@element-plus/icons-vue'
import {
  FlowEngine,
  NODE_TYPES,
  ENGINE_TYPES,
  COLORS,
  GRID_SIZE,
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_RADIUS,
  PORT_RADIUS,
  VIRTUAL_W,
  VIRTUAL_H,
  DEFAULT_VIEW_W,
  DEFAULT_VIEW_H,
  EXECUTION_INTERVAL,
  STEP_DELAY,
  END_NODE_DURATION,
  MAX_EXECUTION_STEPS,
  ZOOM_STEP,
  MIN_ZOOM_W,
  ZOOM_DURATION,
  ZOOM_BASE_W,
  FIT_DURATION,
  RESET_DURATION,
  PAN_MIN,
  GRID_OFFSET,
  GRID_EXTRA,
  ZOOM_DEBOUNCE,
  PATH_GAP,
  PATH_SNAP_THRESHOLD,
  PORT_BEND_PENALTY,
  CONN_HIT_TOLERANCE,
} from '../engine'

const route = useRoute()

/** 获取流程类型信息 */
function getTypeInfo(type) {
  return ENGINE_TYPES[type] || ENGINE_TYPES.custom
}

// ==================== 常量定义 ====================
// 已全部从 src/engine/constants.ts 导入，无本地硬编码

// ==================== 模板引用 ====================

const canvasRef = ref(null)            // 画布容器 div
const svgRef = ref(null)               // SVG 元素

// ==================== 响应式状态 ====================

const editDialogVisible = ref(false)    // 编辑弹窗
const editForm = ref({ name: '', desc: '', cmd: '', nodeType: 'start', color: '#409EFF' })
const editNodeId = ref(null)            // 当前编辑的节点 ID
const exportDialogVisible = ref(false)  // 导出弹窗
const exportJson = ref('')             // 导出内容
const importDialogVisible = ref(false)  // 导入弹窗
const importJson = ref('')             // 导入内容
const isRunning = ref(false)            // 流程执行中标志
const currentTemplate = ref(null)       // 当前加载的模板信息({id, name, type})
const executionLog = ref('')           // 流程日志

// ==================== D3 内部状态 (非响应式) ====================

/** @type {d3.Selection} SVG 顶层选择器 */
let svg = null
/** @type {d3.Selection} 网格层 — 底层，不可交互 */
let gridGroup = null
/** @type {d3.Selection} 连线层 — 中层 */
let connectionGroup = null
/** @type {d3.Selection} 节点层 — 顶层，可拖拽 */
let nodeGroup = null
/** @type {d3.Selection} 动画层 — 最顶层，执行动画用的 token */
let animationGroup = null

/** @type {Array} 节点数据 */
let nodes = []
/** @type {Array} 连线数据 */
let connections = []

let nextNodeId = 1       // 自增节点 ID
let nextConnId = 1       // 自增连线 ID
let dragLine = null      // 正在拖拽的临时连线
let isDraggingLine = false // 连线拖拽中标志

// 画布平移
let panX = 0, panY = 0          // 当前平移偏移量 (viewBox x, y)
let viewW = DEFAULT_VIEW_W, viewH = DEFAULT_VIEW_H   // 当前视口宽高
const zoomPercent = ref(100)    // 响应式缩放比例
let isPanning = false           // 平移拖拽中
let panStart = { x: 0, y: 0 }  // 平移起始位置

// 流程执行相关 — 状态机模式（支持分支/循环）
let executionTimer = null           // 流程执行定时器
let activeNodeId = null             // 当前执行中的节点 ID
let prevNodeId = null               // 上一个执行完成的节点 ID（用于动画路径）
let activeAction = ''               // 当前执行的 action（通过/驳回/转审）
let executionHistory = []           // [{nodeId, nodeName, action}]
let executedActions = new Map()     // nodeId → Set of executed action labels（分支探测）
let animatingToken = null           // 当前动画 token 圆点的 D3 selection
let animatingFlow = null            // 当前流动连线路径引用
let executionConnId = null          // 当前动画经过的连线 ID

// ==================== 数据模型 ====================

/**
 * 创建一个流程节点
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {string} name - 节点名称
 * @param {string} desc - 节点描述
 * @param {string} cmd - 执行的命令
 * @param {string} color - 节点颜色 (hex)
 * @returns {Object} 节点数据对象
 */
function createNode(x, y, name = '新步骤', desc = '', cmd = '', color = '#409EFF', nodeType = 'start') {
  return {
    id: nextNodeId++,
    x: Math.round(x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(y / GRID_SIZE) * GRID_SIZE,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    name, desc, cmd, color, nodeType,
    status: 'idle'
  }
}

/**
 * 创建一条连线
 * @param {number} fromNodeId - 起始节点 ID
 * @param {string} fromPort - 起始端口: 'top'|'right'|'bottom'|'left'
 * @param {number} toNodeId - 目标节点 ID
 * @param {string} toPort - 目标端口: 'top'|'right'|'bottom'|'left'
 * @returns {Object} 连线数据对象
 */
function createConnection(fromNodeId, fromPort, toNodeId, toPort) {
  return { id: nextConnId++, fromNodeId, fromPort, toNodeId, toPort }
}

// ==================== 端口位置计算 ====================

/**
 * 获取节点上指定端口的坐标
 * @param {Object} node - 节点数据
 * @param {string} port - 端口名称: 'top'|'right'|'bottom'|'left'
 * @returns {{x: number, y: number}} 端口绝对坐标
 */
function getPortPosition(node, port) {
  switch (port) {
    case 'top':    return { x: node.x + node.width / 2, y: node.y }
    case 'right':  return { x: node.x + node.width, y: node.y + node.height / 2 }
    case 'bottom': return { x: node.x + node.width / 2, y: node.y + node.height }
    case 'left':   return { x: node.x, y: node.y + node.height / 2 }
    default:       return { x: node.x + node.width / 2, y: node.y + node.height }
  }
}

// ==================== 正交路径生成 ====================

/**
 * 生成正交路径 —— 横平竖直，从A边框中间点到B边框中间点
 *
 * 所有路径: 起点和终点精确对齐到端口坐标，中间段严格水平/垂直
 */
function generateOrthogonalPath(fromPos, toPos, fromPort, toPort) {
  const GAP = PATH_GAP
  const { x: x1, y: y1 } = fromPos
  const { x: x2, y: y2 } = toPos

  // 离开端口的方向偏移
  const dir = (port, p) => {
    switch (port) {
      case 'top':    return { x: p.x,      y: p.y - GAP }
      case 'right':  return { x: p.x + GAP, y: p.y }
      case 'bottom': return { x: p.x,      y: p.y + GAP }
      case 'left':   return { x: p.x - GAP, y: p.y }
      default:       return p
    }
  }
  const o = dir(fromPort, fromPos)
  const i = dir(toPort, toPos)

  // ── 垂直反向: bottom↔top ──
  if ((fromPort === 'bottom' && toPort === 'top') || (fromPort === 'top' && toPort === 'bottom')) {
    return (Math.abs(x1 - x2) < 3)
      ? `M ${x1} ${y1} L ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x1} ${o.y} L ${x2} ${o.y} L ${x2} ${i.y} L ${x2} ${y2}`
  }

  // ── 水平反向: left↔right ──
  if ((fromPort === 'left' && toPort === 'right') || (fromPort === 'right' && toPort === 'left')) {
    return (Math.abs(y1 - y2) < 3)
      ? `M ${x1} ${y1} L ${x2} ${y2}`
      : `M ${x1} ${y1} L ${o.x} ${y1} L ${o.x} ${y2} L ${i.x} ${y2} L ${x2} ${y2}`
  }

  // ── 通用: 单拐角 ──
  const fh = fromPort === 'left' || fromPort === 'right'
  const th = toPort === 'left' || toPort === 'right'

  if (fh && th)       return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`    // 水平→水平
  if (!fh && !th)     return `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`    // 垂直→垂直
  if (fh && !th)      return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`    // 水平→垂直
  return `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`                          // 垂直→水平
}

// ==================== SVG 网格背景 ====================

/**
 * 绘制网格背景
 * 底层: 20px 间距小圆点 pattern
 * 上层: 100px 间距大虚线网格
 */
function drawGrid() {
  if (!gridGroup || !svg || !canvasRef.value) return
  gridGroup.selectAll('*').remove()

  // 获取或创建 defs 容器
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs')
  defs.selectAll('pattern').remove()

  // 小网格 pattern — 20px间距小圆点
  defs.append('pattern')
    .attr('id', 'smallGrid')
    .attr('width', GRID_SIZE).attr('height', GRID_SIZE)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('circle')
    .attr('cx', GRID_SIZE / 2).attr('cy', GRID_SIZE / 2)
    .attr('r', 1.2).attr('fill', '#d0d0d0')

  // 大网格 pattern — 引用小网格 + 虚线边框
  defs.append('pattern')
    .attr('id', 'largeGrid')
    .attr('width', GRID_SIZE * 5).attr('height', GRID_SIZE * 5)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('rect')
    .attr('width', GRID_SIZE * 5).attr('height', GRID_SIZE * 5)
    .attr('fill', 'url(#smallGrid)')

  defs.append('pattern')
    .attr('id', 'gridBorder')
    .attr('width', GRID_SIZE * 5).attr('height', GRID_SIZE * 5)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('path')
    .attr('d', `M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`)
    .attr('fill', 'none').attr('stroke', '#e0e0e0').attr('stroke-width', 0.5)

  // 渲染两层网格 — 以 (0,0) 为中心向四周扩展，覆盖负坐标区域
  const GX = -3000, GY = -3000, GW = VIRTUAL_W + 6000, GH = VIRTUAL_H + 6000
  gridGroup.append('rect').attr('x', GX).attr('y', GY).attr('width', GW).attr('height', GH).attr('fill', 'url(#smallGrid)')
  gridGroup.append('rect').attr('x', GX).attr('y', GY).attr('width', GW).attr('height', GH).attr('fill', 'url(#largeGrid)')
}

// ==================== 渲染连线 ====================

/**
 * 渲染所有连线 — 使用 D3 enter/update/exit 模式
 */
function renderConnections() {
  if (!connectionGroup) return

  // 数据绑定 — 以 id 为 key
  const lines = connectionGroup.selectAll('g.connection').data(connections, d => d.id)

  // === EXIT: 先移除不存在的连线 ===
  lines.exit().remove()

  // === ENTER: 新建连线 ===
  const enterG = lines.enter().append('g').attr('class', 'connection')

  // 连线主路径 (带箭头) — 默认一条零长路径防止 marker 消失
  enterG.append('path')
    .attr('class', 'conn-path')
    .attr('d', 'M 0 0 L 0 0')
    .attr('fill', 'none')
    .attr('stroke', '#999').attr('stroke-width', 2.5)
    .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
    .attr('marker-end', 'url(#arrowhead)')

  // 流程流动动画层
  enterG.append('path')
    .attr('class', 'conn-flow')
    .attr('d', 'M 0 0 L 0 0')
    .attr('fill', 'none')
    .attr('stroke', '#1E90FF').attr('stroke-width', 3)
    .attr('stroke-linecap', 'round')
    .attr('stroke-dasharray', '8 16')
    .attr('opacity', 0)

  // 删除按钮组 — 放在 connection 外以避免 hover 穿透问题
  // 使用一个独立的 g 作为删除热区
  const delGroup = enterG.append('g')
    .attr('class', 'conn-delete-group')
    .attr('cursor', 'pointer')
    .attr('pointer-events', 'all')

  delGroup.append('rect')
    .attr('class', 'conn-delete-bg')
    .attr('x', -14).attr('y', -14)
    .attr('width', 28).attr('height', 28)
    .attr('rx', 14).attr('fill', '#fff')
    .attr('stroke', '#e53935').attr('stroke-width', 2)
    .attr('opacity', 0)

  delGroup.append('text')
    .attr('class', 'conn-delete-x')
    .attr('text-anchor', 'middle').attr('dy', 4)
    .attr('font-size', 14).attr('fill', '#e53935')
    .attr('font-weight', 'bold')
    .text('×')

  // 点击删除
  delGroup.on('click', (event, d) => {
    event.stopPropagation()
    connections = connections.filter(c => c.id !== d.id)
    renderConnections()
    ElMessage.info('连线已删除')
  })

  // 合并 enter 和 update 进行统一更新
  const allLines = lines.merge(enterG)

  // 计算 path d (永远不返回空串，防止 marker 丢失)
  const computePath = (d) => {
    const from = nodes.find(n => n.id === d.fromNodeId)
    const to = nodes.find(n => n.id === d.toNodeId)
    if (!from || !to) return 'M 0 0 L 0 0'
    return generateOrthogonalPath(
      getPortPosition(from, d.fromPort),
      getPortPosition(to, d.toPort),
      d.fromPort, d.toPort
    )
  }

  // 更新所有连线的路径 + 确保 marker 始终存在
  allLines.select('path.conn-path')
    .attr('d', computePath)
    .attr('marker-end', 'url(#arrowhead)')
  allLines.select('path.conn-flow').attr('d', computePath)

  // 删除按钮定位在线路中点
  allLines.select('.conn-delete-group').attr('transform', d => {
    const from = nodes.find(n => n.id === d.fromNodeId)
    const to = nodes.find(n => n.id === d.toNodeId)
    if (!from || !to) return 'translate(0,0)'
    const fp = getPortPosition(from, d.fromPort)
    const tp = getPortPosition(to, d.toPort)
    return `translate(${(fp.x + tp.x) / 2}, ${(fp.y + tp.y) / 2})`
  })

  // === 交互: hover 效果 ===
  allLines.on('mouseenter', function () {
    // 高亮连线 + 显示删除按钮
    d3.select(this).select('path.conn-path').attr('stroke', '#e53935').attr('stroke-width', 3)
    d3.select(this).select('.conn-delete-bg').transition().duration(150).attr('opacity', 1)
    d3.select(this).select('.conn-delete-x').transition().duration(150).attr('opacity', 1)
  }).on('mouseleave', function () {
    d3.select(this).select('path.conn-path').attr('stroke', '#999').attr('stroke-width', 2.5)
    d3.select(this).select('.conn-delete-bg').transition().duration(150).attr('opacity', 0)
    d3.select(this).select('.conn-delete-x').transition().duration(150).attr('opacity', 0)
  })
}

// ==================== 渲染节点 ====================

/**
 * 渲染所有节点 — 使用 D3 enter/update/exit 模式
 * 每个节点有 4 个端口 (上、右、下、左) 用于创建连线
 */
function renderNodes() {
  if (!nodeGroup) return

  // 数据绑定，以 id 为 key
  const nodeEls = nodeGroup.selectAll('g.node').data(nodes, d => d.id)

  // ========== ENTER: 新节点 ==========
  const enterG = nodeEls.enter().append('g')
    .attr('class', 'node').attr('transform', d => `translate(${d.x}, ${d.y})`)
    .attr('cursor', 'grab')
    .call(createNodeDrag()) // 绑定拖拽行为

  // 主体矩形 (圆角)
  enterG.append('rect')
    .attr('class', 'node-body')
    .attr('width', NODE_WIDTH).attr('height', NODE_HEIGHT)
    .attr('rx', NODE_RADIUS).attr('ry', NODE_RADIUS)
    .attr('fill', d => d.color).attr('fill-opacity', 0.9)
    .attr('stroke', d => d3.color(d.color).darker(0.3).toString())
    .attr('stroke-width', 2)
    .attr('filter', 'url(#nodeShadow)')

  // 头部装饰条 — 加深半透明效果
  enterG.append('rect')
    .attr('class', 'node-header-bar')
    .attr('width', NODE_WIDTH).attr('height', 28)
    .attr('rx', NODE_RADIUS).attr('ry', NODE_RADIUS)
    .attr('fill', d => d3.color(d.color).darker(0.15).toString())
    .attr('fill-opacity', 0.5)
  enterG.append('rect')
    .attr('x', 0).attr('y', 18).attr('width', NODE_WIDTH).attr('height', 16)
    .attr('fill', d => d3.color(d.color).darker(0.15).toString())
    .attr('fill-opacity', 0.5)

  // 状态指示圆点 (右上角, 稍大以便看清状态变化)
  enterG.append('circle')
    .attr('class', 'node-status')
    .attr('cx', NODE_WIDTH - 18).attr('cy', 14)
    .attr('r', 7).attr('fill', '#e0e0e0')
    .attr('stroke', '#fff').attr('stroke-width', 2)
    .attr('pointer-events', 'none')

  // 标题文字
  enterG.append('text')
    .attr('class', 'node-title')
    .attr('x', NODE_WIDTH / 2).attr('y', 20)
    .attr('text-anchor', 'middle').attr('fill', '#fff')
    .attr('font-size', 14).attr('font-weight', 'bold')
    .attr('pointer-events', 'none')
    .text(d => d.name)

  // 节点类型标签
  enterG.append('text')
    .attr('class', 'node-type-label')
    .attr('x', NODE_WIDTH / 2).attr('y', 40)
    .attr('text-anchor', 'middle').attr('fill', '#fff')
    .attr('font-size', 10).attr('opacity', 0.7)
    .attr('pointer-events', 'none')
    .text(d => NODE_TYPES[d.nodeType] ? NODE_TYPES[d.nodeType].label : '步骤')

  // 描述文字
  enterG.append('text')
    .attr('class', 'node-desc')
    .attr('x', NODE_WIDTH / 2).attr('y', 56)
    .attr('text-anchor', 'middle').attr('fill', '#fff')
    .attr('font-size', 11).attr('opacity', 0.9)
    .attr('pointer-events', 'none')
    .text(d => d.desc || '暂无描述')

  // 命令文字 (左下)
  enterG.append('text')
    .attr('class', 'node-cmd')
    .attr('x', 12).attr('y', 72).attr('fill', '#fff')
    .attr('font-size', 10).attr('opacity', 0.7)
    .attr('pointer-events', 'none').attr('font-family', 'monospace')
    .text(d => d.cmd || '')

  // 四个端口圆点 — 支持从任意方向拖拽创建连线
  const portConfigs = [
    { port: 'top',    cx: NODE_WIDTH / 2, cy: 0 },
    { port: 'right',  cx: NODE_WIDTH,     cy: NODE_HEIGHT / 2 },
    { port: 'bottom', cx: NODE_WIDTH / 2, cy: NODE_HEIGHT },
    { port: 'left',   cx: 0,              cy: NODE_HEIGHT / 2 }
  ]

  portConfigs.forEach(({ port, cx, cy }) => {
    enterG.append('circle')
      .attr('class', `port port-${port}`)
      .attr('cx', cx).attr('cy', cy).attr('r', PORT_RADIUS)
      .attr('fill', '#fff').attr('stroke', '#1E90FF')
      .attr('stroke-width', 2).attr('cursor', 'crosshair')
      .style('opacity', 0) // 默认隐藏，hover 时显示
      .on('mousedown.port', function (event, d) {
        event.preventDefault()
        event.stopPropagation()
        if (event.stopImmediatePropagation) event.stopImmediatePropagation()
        startConnectionDrag(event, d, port)
      })
  })

  // 拖拽手柄图标 (左上角三横线)
  enterG.append('text')
    .attr('class', 'drag-handle').attr('x', 8).attr('y', 20)
    .attr('fill', '#fff').attr('opacity', 0.5)
    .attr('font-size', 11).attr('pointer-events', 'none')
    .text('⋮⋮')

  // === 节点交互事件 ===

  // hover: 显示四向端口
  enterG.on('mouseenter', function () {
    d3.select(this).selectAll('.port').style('opacity', 1)
    d3.select(this).select('.node-body').attr('fill-opacity', 1).attr('stroke-width', 3)
  }).on('mouseleave', function () {
    if (!isDraggingLine) {
      d3.select(this).selectAll('.port').style('opacity', 0)
    }
    d3.select(this).select('.node-body').attr('fill-opacity', 0.9).attr('stroke-width', 2)
  })

  // 双击 — 打开编辑弹窗
  enterG.on('dblclick.node', (event, d) => {
    event.stopPropagation()
    editNodeId.value = d.id
    editForm.value = { name: d.name, desc: d.desc, cmd: d.cmd, nodeType: d.nodeType || 'start', color: d.color }
    editDialogVisible.value = true
  })

  // 右键 — 删除节点
  enterG.on('contextmenu.node', (event, d) => {
    event.preventDefault()
    const connCount = connections.filter(c => c.fromNodeId === d.id || c.toNodeId === d.id).length
    const msg = connCount ? `将同时删除 ${connCount} 条关联连线` : ''
    if (confirm(`确定删除步骤「${d.name}」吗？${msg}`)) {
      connections = connections.filter(c => c.fromNodeId !== d.id && c.toNodeId !== d.id)
      nodes = nodes.filter(n => n.id !== d.id)
      renderNodes()
      renderConnections()
      ElMessage.info(`已删除「${d.name}」`)
    }
  })

  // ========== UPDATE: 更新已有节点 ==========
  nodeEls.transition().duration(80)
    .attr('transform', d => `translate(${d.x}, ${d.y})`)

  nodeEls.select('rect.node-body')
    .attr('fill', d => d.color)
    .attr('stroke', d => d3.color(d.color).darker(0.3).toString())
  nodeEls.select('rect.node-header-bar')
    .attr('fill', d => d3.color(d.color).darker(0.15).toString())
  nodeEls.select('rect:nth-child(3)')
    .attr('fill', d => d3.color(d.color).darker(0.15).toString())

  // 更新状态圆点颜色
  nodeEls.select('circle.node-status').attr('fill', d => {
    switch (d.status) {
      case 'running': return '#E6A23C'  // 黄色 — 运行中
      case 'done':    return '#67C23A'  // 绿色 — 完成
      case 'error':   return '#F56C6C'  // 红色 — 失败
      default:        return '#e0e0e0'  // 灰色 — 空闲
    }
  })

  nodeEls.select('text.node-title').text(d => d.name)
  nodeEls.select('text.node-type-label').text(d => NODE_TYPES[d.nodeType] ? NODE_TYPES[d.nodeType].label : '步骤')
  nodeEls.select('text.node-desc').text(d => d.desc || '暂无描述')
  nodeEls.select('text.node-cmd').text(d => d.cmd || '')

  // ========== EXIT: 移除不存在节点 ==========
  nodeEls.exit().remove()
}

// ==================== 节点拖拽行为 ====================

/**
 * 创建 D3 drag 行为 — 节点拖拽
 * 拖拽时自动吸附 GRID_SIZE 网格
 *
 * filter: 排除端口圆点上的点击，防止与端口连线拖拽冲突
 */
function createNodeDrag() {
  return d3.drag()
    .filter(event => !event.target.closest('.port'))
    .on('start', function () {
      d3.select(this).attr('cursor', 'grabbing').raise()
    })
    .on('drag', function (event, d) {
      // 吸附网格
      d.x = Math.round(event.x / GRID_SIZE) * GRID_SIZE
      d.y = Math.round(event.y / GRID_SIZE) * GRID_SIZE

      // 虚拟画布边界限制（允许负值，匹配网格覆盖范围 -2000 ~ VIRTUAL_W）
      d.x = Math.max(PAN_MIN, Math.min(d.x, VIRTUAL_W - d.width))
      d.y = Math.max(PAN_MIN, Math.min(d.y, VIRTUAL_H - d.height))

      d3.select(this).attr('transform', `translate(${d.x}, ${d.y})`)
      // 拖拽时同步更新连线路径
      renderConnections()
    })
    .on('end', function (event, d) {
      d3.select(this).attr('cursor', 'grab')
      // 拖拽结束后，优化所有连线的端口选择
      optimizeConnectionPorts()
      renderConnections()
    })
}

/**
 * 根据节点当前位置，自动优化所有连线的端口选择
 * 拖拽结束后调用，确保连线始终选择最优端口
 */
function optimizeConnectionPorts() {
  connections.forEach(conn => {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId)
    const toNode = nodes.find(n => n.id === conn.toNodeId)
    if (!fromNode || !toNode) return

    const fromCx = fromNode.x + fromNode.width / 2
    const fromCy = fromNode.y + fromNode.height / 2
    const toCx = toNode.x + toNode.width / 2
    const toCy = toNode.y + toNode.height / 2

    const allPorts = ['top', 'right', 'bottom', 'left']
    let bestScore = Infinity
    let bestFrom = conn.fromPort
    let bestTo = conn.toPort

    allPorts.forEach(fp => {
      allPorts.forEach(tp => {
        const fromPos = getPortPosition(fromNode, fp)
        const toPos = getPortPosition(toNode, tp)

        // 评分 = 路径长度（曼哈顿） + 弯折惩罚
        const dx = Math.abs(toPos.x - fromPos.x)
        const dy = Math.abs(toPos.y - fromPos.y)
        const bends = (dx > 0 && dy > 0) ? 1 : 0  // 需要折弯时为 1
        const score = dx + dy + bends * 40

        if (score < bestScore) {
          bestScore = score
          bestFrom = fp
          bestTo = tp
        }
      })
    })

    conn.fromPort = bestFrom
    conn.toPort = bestTo
  })
}

// ==================== 连线拖拽创建 ====================

/**
 * 从端口开始拖拽创建新连线
 * @param {MouseEvent} event - 鼠标事件
 * @param {Object} fromNode - 起始节点
 * @param {string} fromPort - 起始端口: 'top'|'right'|'bottom'|'left'
 */
function startConnectionDrag(event, fromNode, fromPort) {
  const portalEl = canvasRef.value
  const fromPos = getPortPosition(fromNode, fromPort)

  // 创建临时虚线跟随鼠标
  dragLine = connectionGroup.append('path')
    .attr('fill', 'none')
    .attr('stroke', '#1E90FF').attr('stroke-width', 2.5)
    .attr('stroke-dasharray', '8 4').attr('stroke-linecap', 'round')

  isDraggingLine = true

  /** 将屏幕像素坐标转换为 SVG viewBox 用户坐标 */
  const screenToSVG = (sx, sy) => {
    const rect = portalEl.getBoundingClientRect()
    const rx = (sx - rect.left) / rect.width
    const ry = (sy - rect.top) / rect.height
    return {
      x: panX + rx * viewW,
      y: panY + ry * viewH,
    }
  }

  const onMouseMove = (e) => {
    const pos = screenToSVG(e.clientX, e.clientY)
    dragLine.attr('d', generateOrthogonalPath(fromPos, pos, fromPort, 'right'))
  }

  const onMouseUp = (e) => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    isDraggingLine = false

    if (dragLine) { dragLine.remove(); dragLine = null }

    // 检测松手位置是否在某个目标节点范围内（使用 SVG 坐标）
    const pos = screenToSVG(e.clientX, e.clientY)
    const px = pos.x
    const py = pos.y

    for (const node of nodes) {
      if (node.id === fromNode.id) continue // 不能连自己

      const inRange = px > node.x - 20 && px < node.x + node.width + 20 &&
                      py > node.y - 20 && py < node.y + node.height + 20
      if (!inRange) continue

      // 智能端口选择：根据拖拽方向 + 节点相对位置，优先选择自然流向
      // 计算节点中心与鼠标的相对位置
      const centerX = node.x + node.width / 2
      const centerY = node.y + node.height / 2
      const dx = px - centerX
      const dy = py - centerY

      let preferredPorts = []
      // 根据鼠标相对目标节点中心的位置，确定优先端口
      if (Math.abs(dx) > Math.abs(dy)) {
        // 水平方向为主 → 优先水平端口
        preferredPorts = dx < 0 ? ['left', 'right', 'top', 'bottom'] : ['right', 'left', 'top', 'bottom']
      } else {
        // 垂直方向为主 → 优先垂直端口
        preferredPorts = dy < 0 ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'top', 'left', 'right']
      }

      // 再根据源端口进一步调整：偏好「自然流向」(下→上, 右→左)
      if (fromPort === 'bottom') preferredPorts = ['top', ...preferredPorts.filter(p => p !== 'top')]
      if (fromPort === 'top')    preferredPorts = ['bottom', ...preferredPorts.filter(p => p !== 'bottom')]
      if (fromPort === 'right')  preferredPorts = ['left', ...preferredPorts.filter(p => p !== 'left')]
      if (fromPort === 'left')   preferredPorts = ['right', ...preferredPorts.filter(p => p !== 'right')]

      // 去重取第一个
      const unique = [...new Set(preferredPorts)]
      const toPort = unique[0]

      // 检查是否已有相同连线
      const exists = connections.some(c =>
        c.fromNodeId === fromNode.id && c.fromPort === fromPort &&
        c.toNodeId === node.id && c.toPort === toPort
      )
      if (!exists) {
        connections.push(createConnection(fromNode.id, fromPort, node.id, toPort))
        renderConnections()
        ElMessage.success('连线已创建')
      }
      return
    }

    // 未命中任何节点 — 连线不创建
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// ==================== 流程执行引擎 — 状态机模式 ====================

/**
 * 获取节点所有出边的连线（按优先级排序）
 * 优先级: 有 action 标记的在前
 */
function getOutgoingEdges(nodeId) {
  return connections
    .filter(c => c.fromNodeId === nodeId)
    .sort((a, b) => (a.action ? -1 : 1) - (b.action ? -1 : 1))
}

/**
 * 根据 action 找到后继节点（支持分支路由 + 循环探测）
 * - approve 节点有多条出线时，优先走还没执行过的"驳回"路径（展示循环）
 * - 已走过驳回后，走"通过"路径
 */
function findNextNode(nodeId, action) {
  const edges = getOutgoingEdges(nodeId)
  if (edges.length === 0) return { node: null, conn: null }

  const node = nodes.find(n => n.id === nodeId)
  const visitedActions = executedActions.get(nodeId) || new Set()

  // 审批节点：优先探测未走过的驳回路径
  if (node && node.nodeType === 'approve' && edges.length > 1) {
    const rejectEdge = edges.find(e => e.action === '驳回' && !visitedActions.has('驳回'))
    if (rejectEdge) {
      visitedActions.add('驳回')
      executedActions.set(nodeId, visitedActions)
      return { node: nodes.find(n => n.id === rejectEdge.toNodeId), conn: rejectEdge }
    }
  }

  // 精确匹配 action
  const exact = edges.find(e => e.action === action)
  if (exact) {
    return { node: nodes.find(n => n.id === exact.toNodeId), conn: exact }
  }

  // 兜底：优先走"通过"路径，否则第一条
  const pass = edges.find(e => e.action === '通过')
  if (pass) {
    return { node: nodes.find(n => n.id === pass.toNodeId), conn: pass }
  }
  const first = edges[0]
  return { node: nodes.find(n => n.id === first.toNodeId), conn: first }
}

/**
 * 启动流程执行模拟
 * 从 start 类型节点开始，沿连线逐节点执行（支持分支/循环）
 */
function startFlowExecution() {
  if (isRunning.value) return

  // 重置所有节点状态
  nodes.forEach(n => { n.status = 'idle' })
  renderNodes()
  clearExecutionAnimation()

  // 找到起始节点
  const startNode = nodes.find(n => n.nodeType === 'start' || n.name.includes('发起'))
  if (!startNode && nodes.length === 0) {
    ElMessage.warning('画布上没有步骤节点')
    return
  }
  const firstNode = startNode || nodes[0]

  isRunning.value = true
  activeNodeId = firstNode.id
  prevNodeId = null
  activeAction = '提交'
  executionHistory = []
  executedActions = new Map()

  executionLog.value = `🔹 流程启动 — ${firstNode.name}`
  ElMessage.info(`流程启动 — ${firstNode.name}`)

  // 开始执行第一个节点
  executeCurrentNode()
}

/**
 * 执行当前活跃节点
 */
function executeCurrentNode() {
  const node = nodes.find(n => n.id === activeNodeId)
  if (!node) {
    finishExecution('流程异常：节点丢失')
    return
  }

  // 标记当前节点为运行中
  node.status = 'running'
  renderNodes()
  executionLog.value = `⏳ 正在执行: ${node.name} (${activeAction || '自动'})`

  // 动画 token 从上一个节点飞到当前节点
  animateTokenToCurrent()

  // 模拟执行延迟
  executionTimer = setTimeout(() => {
    // 标记完成
    node.status = 'done'
    executionHistory.push({ nodeId: node.id, nodeName: node.name, action: activeAction })

    renderNodes()
    executionLog.value = `✅ 已完成: ${node.name}`

    // 清理动画
    clearExecutionAnimation()

    // 找后继节点
    const { node: nextNode, conn } = findNextNode(activeNodeId, activeAction)

    if (!nextNode) {
      finishExecution('流程结束 — 无后继节点')
      return
    }

    // 检查是否为结束节点
    if (nextNode.nodeType === 'end') {
      prevNodeId = activeNodeId
      activeNodeId = nextNode.id
      activeAction = ''
      // 执行结束节点（无延迟，直接完成）
      executionTimer = setTimeout(() => {
        executeEndNode(nextNode)
      }, 400)
      return
    }

    // 判断是否需要继续（防止无限循环，最多执行 N 步）
    if (executionHistory.length >= 50) {
      finishExecution('流程达到最大步数限制 (50)')
      return
    }

    // 跳到下一个节点
    prevNodeId = activeNodeId
    activeNodeId = nextNode.id
    activeAction = conn.action || '继续'

    executionTimer = setTimeout(() => {
      executeCurrentNode()
    }, 600)
  }, EXECUTION_INTERVAL)
}

/** 执行结束节点 */
function executeEndNode(node) {
  activeNodeId = node.id
  // prevNodeId 保持来自 executeCurrentNode 设置的值，用于连线动画
  node.status = 'running'
  renderNodes()
  executionLog.value = `🏁 到达终点: ${node.name}`

  // 动画 token 从上一个节点飞来
  animateTokenToCurrent()

  executionTimer = setTimeout(() => {
    node.status = 'done'
    renderNodes()
    finishExecution('🎉 流程执行完毕')
  }, 1000)
}

/**
 * 动画 token — 从 prevNode 沿连线飞到当前活跃节点
 * 支持分支预览: 多出线时短暂显示所有可能路径
 */
function animateTokenToCurrent() {
  clearExecutionAnimation()

  const currentNode = nodes.find(n => n.id === activeNodeId)
  if (!currentNode) return

  if (prevNodeId) {
    const prevNode = nodes.find(n => n.id === prevNodeId)
    if (!prevNode) return

    // 查找两者之间的连线
    const conn = connections.find(c =>
      c.fromNodeId === prevNode.id && c.toNodeId === currentNode.id
    )
    if (!conn) return

    executionConnId = conn.id

    // === 分支预览: 若 prevNode 有多条出线，先短暂显示所有路径 ===
    const allOutgoing = connections.filter(c => c.fromNodeId === prevNode.id)
    if (allOutgoing.length > 1) {
      allOutgoing.forEach(edge => {
        connectionGroup.selectAll('g.connection')
          .filter(d => d.id === edge.id)
          .select('path.conn-path')
          .transition().duration(200)
          .attr('stroke', edge.id === conn.id ? COLORS.lineFlow : COLORS.warning)
          .attr('stroke-width', edge.id === conn.id ? 3 : 1.5)
          .attr('opacity', edge.id === conn.id ? 1 : 0.4)
      })
    }

    // 高亮该连线并启动流动动画
    connectionGroup.selectAll('g.connection')
      .filter(d => d.id === conn.id)
      .select('path.conn-path')
      .attr('opacity', 0.3)
      .attr('stroke', COLORS.lineFlow)

    const flowPath = connectionGroup.selectAll('g.connection')
      .filter(d => d.id === conn.id)
      .select('path.conn-flow')
      .attr('opacity', 1)
      .attr('stroke-dashoffset', 0)
      .interrupt()

    function flowAnim() {
      flowPath.transition().duration(400).ease(d3.easeLinear)
        .attr('stroke-dashoffset', -24)
        .transition().duration(0)
        .attr('stroke-dashoffset', 0)
        .on('end', flowAnim)
    }
    flowAnim()
    animatingFlow = flowPath

    // Token 圆点沿路径移动
    const fromPos = getPortPosition(prevNode, conn.fromPort)
    const toPos = getPortPosition(currentNode, conn.toPort)

    animatingToken = animationGroup.append('circle')
      .attr('r', 8).attr('fill', '#1E90FF')
      .attr('stroke', '#fff').attr('stroke-width', 2)
      .attr('opacity', 0.9)
      .attr('cx', fromPos.x).attr('cy', fromPos.y)

    animatingToken.transition().duration(800)
      .attr('cx', toPos.x).attr('cy', toPos.y)
      .on('end', () => {
        if (animatingToken) {
          animatingToken.interrupt()
          animatingToken.transition().duration(400)
            .attr('r', 10).attr('opacity', 0.6)
            .transition().duration(400)
            .attr('r', 8).attr('opacity', 0.9)
            .on('end', function () { if (animatingToken) flashTokenLoop() })
        }
      })
  } else {
    // 起始节点，直接在节点上显示闪烁 token
    const pos = { x: currentNode.x + currentNode.width / 2, y: currentNode.y - 25 }
    animatingToken = animationGroup.append('circle')
      .attr('r', 8).attr('fill', '#E6A23C')
      .attr('stroke', '#fff').attr('stroke-width', 2)
      .attr('opacity', 0.9)
      .attr('cx', pos.x).attr('cy', pos.y)
    flashTokenLoop()
  }
}

function flashTokenLoop() {
  if (!animatingToken) return
  animatingToken.interrupt()
  animatingToken.transition().duration(400)
    .attr('r', 10).attr('opacity', 0.6)
    .transition().duration(400)
    .attr('r', 8).attr('opacity', 0.9)
    .on('end', () => { if (animatingToken) flashTokenLoop() })
}

/** 清除所有执行动画 */
function clearExecutionAnimation() {
  if (animatingToken) {
    animatingToken.interrupt().transition().duration(200).attr('r', 0).remove()
    animatingToken = null
  }
  animatingFlow = null
  executionConnId = null
  connectionGroup.selectAll('.conn-flow').interrupt().attr('opacity', 0)
  connectionGroup.selectAll('.conn-path')
    .interrupt().attr('opacity', 1).attr('stroke', '#999')
}

/**
 * 完成全部流程执行
 */
function finishExecution(msg) {
  isRunning.value = false
  executionLog.value = msg
  if (executionTimer) { clearTimeout(executionTimer); executionTimer = null }

  clearExecutionAnimation()

  ElMessage.success(msg)

  // 短暂高亮所有完成节点
  nodeGroup.selectAll('.node-body')
    .transition().duration(300).attr('stroke', '#67C23A').attr('stroke-width', 3)
    .transition().duration(500).attr('stroke', d => d3.color(d.color).darker(0.3).toString()).attr('stroke-width', 2)
}

/** 停止流程 */
function stopFlowExecution() {
  if (executionTimer) { clearTimeout(executionTimer); executionTimer = null }
  isRunning.value = false
  executionLog.value = '⏸ 流程已暂停'
  clearExecutionAnimation()
  ElMessage.warning('流程已暂停')
}

/** 重置流程状态 */
function resetFlowExecution() {
  if (executionTimer) { clearTimeout(executionTimer); executionTimer = null }
  isRunning.value = false
  activeNodeId = null
  prevNodeId = null
  activeAction = ''
  executionHistory = []
  executedActions = new Map()
  executionLog.value = ''

  nodes.forEach(n => { n.status = 'idle' })
  renderNodes()
  clearExecutionAnimation()

  ElMessage.info('流程已重置')
}

// ==================== 初始化 ====================

/**
 * 初始化 D3 — 创建 SVG 层级、滤镜、绑定事件
 */
function initD3() {
  svg = d3.select(svgRef.value)

  // 设置虚拟画布 viewBox，支持平移浏览
  if (canvasRef.value) {
    viewW = canvasRef.value.clientWidth
    viewH = canvasRef.value.clientHeight
    svg.attr('viewBox', `0 0 ${viewW} ${viewH}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
  }

  // === SVG 滤镜和标记 ===
  const defs = svg.append('defs')

  // 节点阴影滤镜
  const shadow = defs.append('filter')
    .attr('id', 'nodeShadow')
    .attr('x', '-20%').attr('y', '-20%')
    .attr('width', '140%').attr('height', '140%')
  shadow.append('feDropShadow')
    .attr('dx', 0).attr('dy', 3)
    .attr('stdDeviation', 4)
    .attr('flood-color', '#000')
    .attr('flood-opacity', 0.25)

  // 激活状态的橙色发光
  const glow = defs.append('filter')
    .attr('id', 'nodeGlow')
    .attr('x', '-30%').attr('y', '-30%')
    .attr('width', '160%').attr('height', '160%')
  glow.append('feDropShadow')
    .attr('dx', 0).attr('dy', 0)
    .attr('stdDeviation', 6)
    .attr('flood-color', '#E6A23C')
    .attr('flood-opacity', 0.5)

  // 连线箭头标记
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10').attr('refX', 8).attr('refY', 5)
    .attr('markerWidth', 7).attr('markerHeight', 7)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#999')

  // === 创建渲染层级 (从底到顶) ===
  gridGroup = svg.append('g').attr('class', 'grid-layer')              // 第0层: 网格
  connectionGroup = svg.append('g').attr('class', 'connection-layer')  // 第1层: 连线
  nodeGroup = svg.append('g').attr('class', 'node-layer')              // 第2层: 节点
  animationGroup = svg.append('g').attr('class', 'animation-layer')    // 第3层: 动画

  // 画布空白处点击 — 取消选中/dialog（已由 canvas div mousedown 处理）

  // 画布平移 — 按住空白区域拖拽（挂在 canvas 容器上，避免 grid rect 拦截事件）
  d3.select(canvasRef.value).on('mousedown.pan', (event) => {
    // 排除点击节点、连线、端口的情况（这些有自己的拖拽逻辑）
    const target = event.target
    if (target.closest('.node') || target.closest('.connection') || target.closest('.port')) return
    if (isDraggingLine) return
    if (event.button !== 0) return
    isPanning = true
    panStart = { x: event.clientX, y: event.clientY }
    d3.select(canvasRef.value).style('cursor', 'grabbing')
  })

  d3.select(window).on('mousemove.pan', (event) => {
    if (!isPanning) return
    const dx = event.clientX - panStart.x
    const dy = event.clientY - panStart.y
    panStart = { x: event.clientX, y: event.clientY }

    panX -= dx
    panY -= dy
    panX = Math.max(-2000, Math.min(panX, VIRTUAL_W - viewW))
    panY = Math.max(-2000, Math.min(panY, VIRTUAL_H - viewH))
    svg.attr('viewBox', `${panX} ${panY} ${viewW} ${viewH}`)
  })

  d3.select(window).on('mouseup.pan', () => {
    if (isPanning) {
      isPanning = false
      d3.select(canvasRef.value).style('cursor', 'default')
    }
  })

  // 滚轮缩放 — Figma 风格平滑缩放，以内容中心为锚点
  let wheelTimer = null
  svg.on('wheel.pan', (event) => {
    event.preventDefault()
    const scale = event.deltaY > 0 ? 1.12 : 1 / 1.12
    const newW = Math.round(viewW * scale)
    const newH = Math.round(viewH * scale)
    if (newW < 400 || newW > VIRTUAL_W) return

    // 以内容区中心为缩放锚点，不钳位到 0 以确保真正居中
    const { cx, cy } = getContentCenter()
    const tPanX = Math.round(cx - newW / 2)
    const tPanY = Math.round(cy - newH / 2)

    clearTimeout(wheelTimer)
    wheelTimer = setTimeout(() => {
      smoothViewBox(Math.round(tPanX), Math.round(tPanY), newW, newH, 180)
      updateZoomPercent()
    }, 20)
  })

  window.addEventListener('resize', onResize)

  // 绘制网格
  drawGrid()

  // 加载初始数据: 优先从 URL 参数 tpl 加载模板，否则用默认流程
  loadInitialFlow()
}

/**
 * 加载初始流程数据
 * - 有 ?tpl=xxx → 从 localStorage 加载对应模板
 * - 无参数 → 使用默认 CI/CD 流程
 */
function loadInitialFlow() {
  const tplId = route.query.tpl

  if (tplId) {
    const templates = FlowEngine.loadTemplates()
    const tpl = templates.find(t => t.id === tplId)

    if (tpl && tpl.nodes && tpl.nodes.length > 0) {
      currentTemplate.value = { id: tpl.id, name: tpl.name, type: tpl.type }

      nextNodeId = Math.max(...tpl.nodes.map(n => n.id), 0) + 1
      nextConnId = Math.max(...tpl.connections.map(c => c.id), 0) + 1

      nodes = tpl.nodes.map(n => ({
        ...n, status: 'idle', nodeType: n.nodeType || 'start',
        width: n.width || NODE_WIDTH, height: n.height || NODE_HEIGHT
      }))
      connections = tpl.connections.map(c => ({ ...c }))

      // 初始加载后自动优化端口选择
      optimizeConnectionPorts()
      renderNodes()
      renderConnections()
      // 自动适应内容显示
      nextTick(() => { fitToContent(); updateZoomPercent() })
      ElMessage.success(`已加载「${tpl.name}」（${tpl.nodes.length} 步骤, ${tpl.type}）`)
      return
    }
    ElMessage.warning('未找到指定模板，使用默认流程')
  }

  currentTemplate.value = null
  initDefaultNodes()
}

/** 窗口尺寸变化时更新 viewBox */
function onResize() {
  const el = canvasRef.value
  if (el && svg) {
    viewW = el.clientWidth
    viewH = el.clientHeight
    panX = Math.max(-2000, Math.min(panX, VIRTUAL_W - viewW))
    panY = Math.max(-2000, Math.min(panY, VIRTUAL_H - viewH))
    svg.attr('viewBox', `${panX} ${panY} ${viewW} ${viewH}`)
    drawGrid()
    updateZoomPercent()
  }
}

/** 同步响应式缩放百分比 */
function updateZoomPercent() {
  zoomPercent.value = Math.round(ZOOM_BASE_W / viewW * 100)
}

/** 获取所有节点的包围盒中心点（空画布时返回原点） */
function getContentCenter() {
  if (nodes.length === 0) return { cx: 0, cy: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach(n => {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x + n.width > maxX) maxX = n.x + n.width
    if (n.y + n.height > maxY) maxY = n.y + n.height
  })
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2
  }
}

/**
 * Figma 风格平滑过渡 viewBox
 * 使用 D3 自定义 tween，对 panX/panY/viewW/viewH 做 ease 插值
 */
function smoothViewBox(tPX, tPY, tVW, tVH, duration = 300) {
  if (!svg) return

  // 从 SVG 实际 viewBox 读取当前值，避免被 JS 变量中间态污染
  const actualVB = svg.attr('viewBox')?.split(' ').map(Number) || [panX, panY, viewW, viewH]
  const sPX = actualVB[0], sPY = actualVB[1], sVW = actualVB[2], sVH = actualVB[3]

  // 无变化时跳过
  if (Math.abs(sPX - tPX) < 1 && Math.abs(sPY - tPY) < 1 && Math.abs(sVW - tVW) < 1 && Math.abs(sVH - tVH) < 1) return

  // 先中断之前的过渡动画，再启动新的
  svg.interrupt('viewBox')

  svg.transition().duration(duration).ease(d3.easeCubicOut)
    .tween('viewBox', () => {
      const iPX = d3.interpolate(sPX, tPX)
      const iPY = d3.interpolate(sPY, tPY)
      const iVW = d3.interpolate(sVW, tVW)
      const iVH = d3.interpolate(sVH, tVH)
      return (t) => {
        panX = Math.round(iPX(t))
        panY = Math.round(iPY(t))
        viewW = Math.round(iVW(t))
        viewH = Math.round(iVH(t))
        svg.attr('viewBox', `${panX} ${panY} ${viewW} ${viewH}`)
      }
    })
    .on('end', () => {
      updateZoomPercent()
    })
}

/** 自动缩放/平移到适合所有节点 */
function fitToContent() {
  if (nodes.length === 0) {
    ElMessage.info('画布上没有节点')
    return
  }
  const el = canvasRef.value
  if (!el || !svg) return

  // 计算所有节点的包围盒
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach(n => {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x + n.width > maxX) maxX = n.x + n.width
    if (n.y + n.height > maxY) maxY = n.y + n.height
  })

  const padding = 120
  const contentW = maxX - minX + padding * 2
  const contentH = maxY - minY + padding * 2
  const containerW = el.clientWidth
  const containerH = el.clientHeight

  // 按较大维度适配，保持宽高比
  let tVW, tVH
  if (contentW / contentH > containerW / containerH) {
    tVW = Math.round(contentW * 1.15)
    tVH = Math.round(tVW / containerW * containerH)
  } else {
    tVH = Math.round(contentH * 1.15)
    tVW = Math.round(tVH / containerH * containerW)
  }

  tVW = Math.max(400, Math.min(tVW, VIRTUAL_W))
  tVH = Math.max(300, Math.min(tVH, VIRTUAL_H))

  // 居中内容（不钳位到 0，允许负值实现真正居中）
  let tPX = minX - padding - (tVW - contentW) / 2
  let tPY = minY - padding - (tVH - contentH) / 2
  tPX = Math.round(tPX)
  tPY = Math.round(tPY)

  smoothViewBox(tPX, tPY, tVW, tVH, 400)
  ElMessage.success('已适应内容')
}

/** 重置为默认视图 (100% 缩放，原点对齐) */
function resetView() {
  const el = canvasRef.value
  if (!el || !svg) return
  const tVW = el.clientWidth || 1200
  const tVH = el.clientHeight || 800
  smoothViewBox(0, 0, tVW, tVH, 350)
  nextTick(() => drawGrid())
  ElMessage.info('视图已重置')
}

/**
 * 预设默认 CI/CD 流程
 * Git拉取 → 依赖安装 → 代码构建 → 运行测试 → 部署发布
 */
function initDefaultNodes() {
  nodes = [
    createNode(80, 80, 'Git 拉取代码', '从代码仓库拉取最新代码', 'git pull origin main'),
    createNode(80, 220, '依赖安装', '安装项目依赖包', 'npm install'),
    createNode(80, 360, '代码构建', '项目编译构建', 'npm run build'),
    createNode(80, 500, '运行测试', '执行单元测试和集成测试', 'npm run test', '#67C23A'),
    createNode(80, 640, '部署发布', '发布到生产/预发环境', 'deploy.sh', '#E6A23C')
  ]

  // 节点纵向串联
  connections = [
    createConnection(1, 'bottom', 2, 'top'),
    createConnection(2, 'bottom', 3, 'top'),
    createConnection(3, 'bottom', 4, 'top'),
    createConnection(4, 'bottom', 5, 'top')
  ]

  renderNodes()
  renderConnections()
  // 默认流程也自动居中
  nextTick(() => fitToContent())
}

// ==================== 工具栏操作 ====================

/** 在画布中央添加一个新步骤节点 */
function addNode() {
  const cx = 400 + Math.random() * 400
  const cy = 100 + Math.random() * 500
  const node = createNode(cx, cy, `步骤 ${nextNodeId}`, '新步骤描述', '', '#409EFF')
  nodes.push(node)
  renderNodes()
  ElMessage.success('已添加新步骤 (双击编辑名称)')
}

/** 清空画布上所有节点和连线 */
function clearAll() {
  if (nodes.length === 0) return
  if (!confirm('确定清空画布上的所有节点和连线吗？此操作不可恢复！')) return
  resetFlowExecution()
  nodes = []
  connections = []
  nextNodeId = 1
  nextConnId = 1
  renderNodes()
  renderConnections()
  ElMessage.info('画布已清空')
}

/** 保存编辑弹窗内的节点信息 */
function saveEdit() {
  const node = nodes.find(n => n.id === editNodeId.value)
  if (node) {
    node.name = editForm.value.name
    node.desc = editForm.value.desc
    node.cmd = editForm.value.cmd
    node.color = editForm.value.color
    node.nodeType = editForm.value.nodeType || 'start'
    renderNodes()
  }
  editDialogVisible.value = false
  ElMessage.success('步骤已更新')
}

/** 导出流程为 JSON 字符串 */
function exportFlow() {
  const data = {
    nodes: nodes.map(n => ({ ...n, status: 'idle' })), // 重置状态后导出
    connections: connections.map(c => ({ ...c }))
  }
  exportJson.value = JSON.stringify(data, null, 2)
  exportDialogVisible.value = true
}

/** 复制导出 JSON 到剪贴板 */
function copyExportJson() {
  navigator.clipboard.writeText(exportJson.value).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.warning('复制失败，请手动选择并复制')
  })
}

/** 打开导入弹窗 */
function importFlow() {
  importJson.value = ''
  importDialogVisible.value = true
}

/** 执行 JSON 导入 */
function doImportJson() {
  const json = importJson.value.trim()
  if (!json) return
  try {
    const data = JSON.parse(json)
    if (!data.nodes || !Array.isArray(data.nodes) || !data.connections || !Array.isArray(data.connections)) {
      ElMessage.error('JSON 格式不正确，需要 nodes (数组) 和 connections (数组) 字段')
      return
    }
    resetFlowExecution()
    nodes = data.nodes.map(n => ({ ...n, status: 'idle' }))
    connections = data.connections.map(c => ({ ...c }))
    nextNodeId = Math.max(...nodes.map(n => n.id), 0) + 1
    nextConnId = Math.max(...connections.map(c => c.id), 0) + 1
    renderNodes()
    renderConnections()
    optimizeConnectionPorts()
    importDialogVisible.value = false
    // 导入后自动适应内容居中
    setTimeout(() => fitToContent(), 100)
    ElMessage.success(`流程已导入 — ${nodes.length} 个节点, ${connections.length} 条连线`)
  } catch (e) {
    ElMessage.error('JSON 解析失败: ' + e.message)
  }
}

/** 保存当前布局到模板（更新节点位置 + 连线到 localStorage） */
function saveLayout() {
  if (!currentTemplate.value) {
    ElMessage.warning('当前未加载模板，请先从模板列表打开')
    return
  }
  const templates = FlowEngine.loadTemplates()
  const tpl = templates.find(t => t.id === currentTemplate.value.id)
  if (!tpl) {
    ElMessage.error('模板数据丢失，请重新从模板列表加载')
    return
  }

  // 更新模板中的节点和连线数据
  tpl.nodes = nodes.map(n => ({
    id: n.id, x: n.x, y: n.y, width: n.width, height: n.height,
    name: n.name, desc: n.desc, cmd: n.cmd,
    color: n.color, nodeType: n.nodeType, status: 'idle'
  }))
  tpl.connections = connections.map(c => ({ ...c }))

  // 通过 FlowEngine 统一保存（修复: 原直接用 localStorage 写入 'vqs_flow_templates' key,
  // 与 FlowEngine 的 'flow-templates-v3' 不一致，导致数据孤岛）
  FlowEngine.saveTemplate(tpl)
  ElMessage.success(`「${currentTemplate.value.name}」布局已保存（${nodes.length} 节点, ${connections.length} 连线）`)
}

// ==================== 生命周期 ====================

onMounted(() => {
  nextTick(() => initD3())
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  d3.select(window).on('mousemove.pan', null).on('mouseup.pan', null)
  if (canvasRef.value) d3.select(canvasRef.value).on('mousedown.pan', null)
  resetFlowExecution()
  // 清理 D3
  if (svg) { svg.selectAll('*').remove(); svg = null }
})
</script>

<style scoped>
/* ==================== 页面布局 ==================== */
.pipeline-page {
  display: flex;
  flex-direction: column;
  height: 100vh;           /* 满屏 — 脱离项目 header/footer */
  background: #f8f9fa;
}

/* ==================== 工具栏 ==================== */
.pipeline-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  z-index: 10;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-left .el-button + .el-button {
  margin-left: 0;
}

.toolbar-left .el-divider--vertical {
  margin: 0 4px;
  height: 20px;
}

.toolbar-title {
  font-size: 14px;
  font-weight: 700;
  color: #303133;
}

.toolbar-type-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: #fff;
  font-weight: 500;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.zoom-indicator {
  font-size: 11px;
  color: #909399;
  font-weight: 500;
  min-width: 36px;
  text-align: center;
}

.execution-log {
  font-size: 12px;
  color: #409EFF;
  font-weight: 500;
}

.hint-btn {
  color: #909399 !important;
  font-size: 15px;
  padding: 2px !important;
}

/* ==================== SVG 画布 ==================== */
.pipeline-canvas {
  flex: 1;
  overflow: hidden;
  position: relative;
  cursor: grab;
}

.pipeline-canvas:active {
  cursor: grabbing;
}

.pipeline-canvas :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
