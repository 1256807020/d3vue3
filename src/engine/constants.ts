/**
 * FlowEngine 全局常量
 * 所有硬编码值集中管理，便于维护和主题定制
 *
 * @module engine/constants
 */

import type {
  NodeStatus,
  NodeTransitionMap,
  NodeTypeRegistry,
  FlowStatus,
  FlowType,
  EngineTypeRegistry,
} from './types'

// ==================== 存储 ====================

/** localStorage 键名（全局唯一，前后端共用） */
export const STORAGE_KEY = 'flow-templates-v3' as const

// ==================== 画布与节点 ====================

/** 网格吸附单元 (px) */
export const GRID_SIZE = 20

/** 默认节点宽度 */
export const NODE_WIDTH = 190

/** 默认节点高度 */
export const NODE_HEIGHT = 84

/** 节点圆角半径 */
export const NODE_RADIUS = 12

/** 端口圆点半径 (hover 时显示的连接点) */
export const PORT_RADIUS = 7

/** 正交路径离开端口的偏移距离 */
export const PATH_GAP = 30

/** 路径同轴简化阈值 (px) — 在此范围内的偏差忽略，避免微小弯折 */
export const PATH_SNAP_THRESHOLD = 3

/** 端口优化时的弯折惩罚分 */
export const PORT_BEND_PENALTY = 40

/** 连接命中检测容差 (px) */
export const CONN_HIT_TOLERANCE = 20

// ==================== 虚拟画布 ====================

/** 虚拟画布宽度 */
export const VIRTUAL_W = 5000

/** 虚拟画布高度 */
export const VIRTUAL_H = 5000

/** 默认视口宽度（初始化用，实际会在 resize 时更新） */
export const DEFAULT_VIEW_W = 1200

/** 默认视口高度 */
export const DEFAULT_VIEW_H = 800

/** 网格背景覆盖偏移（向左/上扩展，确保负坐标也有网格） */
export const GRID_OFFSET = -3000

/** 网格背景扩展量 */
export const GRID_EXTRA = 6000

/** 缩放最小视口宽度 */
export const MIN_ZOOM_W = 400

/** 滚轮缩放步进因子 */
export const ZOOM_STEP = 1.12

/** 缩放防抖间隔 (ms) */
export const ZOOM_DEBOUNCE = 20

/** smoothViewBox 默认动画时长 */
export const ZOOM_DURATION = 180

/** fitToContent 动画时长 */
export const FIT_DURATION = 400

/** resetView 动画时长 */
export const RESET_DURATION = 350

/** 缩放百分比计算基准 */
export const ZOOM_BASE_W = 1200

/** 画布平移下限 (允许负值以支持居中) */
export const PAN_MIN = -2000

// ==================== 流程执行 ====================

/** 每步执行间隔 (ms) */
export const EXECUTION_INTERVAL = 1500

/** 执行步骤间延迟 */
export const STEP_DELAY = 600

/** 结束节点执行时长 */
export const END_NODE_DURATION = 1000

/** 最大执行步数（防止无限循环） */
export const MAX_EXECUTION_STEPS = 50

// ==================== 颜色 ====================

/** 统一颜色调色板 */
export const COLORS = {
  primary: '#409EFF',
  success: '#67C23A',
  warning: '#E6A23C',
  danger: '#F56C6C',
  info: '#909399',
  dark: '#303133',

  /** 连线默认色 */
  lineDefault: '#999',
  /** 连线流动高亮色 */
  lineFlow: '#1E90FF',
  /** 连线 hover 删除色 */
  lineDelete: '#e53935',

  /** 节点状态色 */
  statusRunning: '#E6A23C',
  statusDone: '#67C23A',
  statusError: '#F56C6C',
  statusIdle: '#e0e0e0',

  /** 网格 */
  gridDot: '#d0d0d0',
  gridBorder: '#e0e0e0',

  /** 文本 */
  textWhite: '#fff',
  textHint: '#bbb',
  textLog: '#409EFF',
} as const

// ==================== Action 标签 ====================

/**
 * Action 标签常量
 * 所有流程执行中的行为标签统一使用这些常量，避免字符串散落
 */
export const ACTIONS = {
  /** 提交申请 */
  SUBMIT: '提交',
  /** 审批通过 */
  APPROVE: '通过',
  /** 审批驳回 */
  REJECT: '驳回',
  /** 转审 */
  TRANSFER: '转审',
  /** 升级处理 */
  ESCALATE: '升级',
  /** 接管审批（超时升级） */
  TAKE_OVER: '接管审批',
  /** 重新提交（驳回后修改重交） */
  RESUBMIT: '重新提交',
  /** 继续（无特定 action） */
  CONTINUE: '继续',
  /** 完成 */
  DONE: 'done',
} as const

// ==================== 节点类型注册表 ====================

/** 所有支持的节点类型 */
export const NODE_TYPES: NodeTypeRegistry = {
  start: {
    label: '发起',
    color: '#409EFF',
    shape: 'circle',
    actions: [ACTIONS.SUBMIT],
    canLoop: false,
    desc: '流程起点，提交申请',
    icon: 'VideoPlay',
  },
  approve: {
    label: '审批',
    color: '#67C23A',
    shape: 'rounded',
    actions: [ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.TRANSFER, ACTIONS.ESCALATE],
    canLoop: true,
    desc: '审批节点，可多轮审批',
    icon: 'Checked',
  },
  modify: {
    label: '修改重交',
    color: '#E6A23C',
    shape: 'rounded',
    actions: [ACTIONS.RESUBMIT],
    canLoop: true,
    desc: '驳回后修改内容重新提交',
    icon: 'Edit',
  },
  escalate: {
    label: '升级处理',
    color: '#F56C6C',
    shape: 'diamond',
    actions: [ACTIONS.TAKE_OVER],
    canLoop: false,
    desc: '超时升级、高级别接管',
    icon: 'WarningFilled',
  },
  notify: {
    label: '抄送知会',
    color: '#909399',
    shape: 'rounded',
    actions: [],
    canLoop: false,
    desc: '通知相关人员，无需操作',
    icon: 'Bell',
  },
  end: {
    label: '结束',
    color: '#303133',
    shape: 'circle',
    actions: [],
    canLoop: false,
    desc: '流程终点',
    icon: 'CircleClose',
  },
} as const

// ==================== 节点状态机 ====================

/** 所有可能的节点状态 */
export const NODE_STATES: NodeStatus[] = [
  'idle',
  'running',
  'done',
  'error',
  'rejected',
  'timeout',
]

/** 合法状态转移规则 */
export const VALID_TRANSITIONS: NodeTransitionMap = {
  idle: ['running'],
  running: ['done', 'error', 'rejected', 'timeout'],
  done: ['running'],
  rejected: ['running', 'idle'],
  error: ['running'],
  timeout: ['running'],
} as const

// ==================== 流程状态 ====================

/** 所有可能的流程状态 */
export const FLOW_STATES: FlowStatus[] = [
  'draft',
  'active',
  'paused',
  'completed',
  'terminated',
  'rejected',
]

// ==================== 审批模式 ====================

/** 默认审批模式 */
export const DEFAULT_APPROVE_MODE = 'manual' as const

/** 默认操作人（自动模式） */
export const DEFAULT_OPERATOR = '系统'

// ==================== 流程类型注册表 ====================

/** 所有支持的流程类型 */
export const ENGINE_TYPES: EngineTypeRegistry = {
  cicd: {
    label: 'CI/CD 管线',
    color: '#409EFF',
    icon: 'Setting',
    desc: '构建、测试、部署自动化流程',
    defaultNodes: [
      { name: '拉取代码', desc: 'git pull', cmd: 'git pull origin main', nodeType: 'start' },
      { name: '安装依赖', desc: '安装依赖', cmd: 'npm install', nodeType: 'start' },
      { name: '代码构建', desc: '项目编译', cmd: 'npm run build', nodeType: 'start' },
      { name: '运行测试', desc: '单元测试', cmd: 'npm run test', nodeType: 'start' },
      { name: '部署发布', desc: '发布上线', cmd: 'deploy.sh', nodeType: 'end' },
    ],
  },
  approval: {
    label: '审批流',
    color: '#67C23A',
    icon: 'Checked',
    desc: '请假、报销、采购等审批流程',
    defaultNodes: [
      { name: '发起申请', desc: '填写申请表单', cmd: '', nodeType: 'start' },
      { name: '直属上级审批', desc: '直属 leader 审批', cmd: '', nodeType: 'approve' },
      { name: '部门负责人审批', desc: '部门级审批', cmd: '', nodeType: 'approve' },
      { name: '驳回修改', desc: '根据驳回意见修改', cmd: '', nodeType: 'modify' },
      { name: '高管审批', desc: '超额/升级审批', cmd: '', nodeType: 'approve' },
      { name: '人事确认', desc: 'HR 最终确认', cmd: '', nodeType: 'end' },
    ],
  },
  release: {
    label: '发布流',
    color: '#E6A23C',
    icon: 'Upload',
    desc: '灰度发布、全量上线、回滚流程',
    defaultNodes: [
      { name: '提交发布单', desc: '发布申请', cmd: '', nodeType: 'start' },
      { name: '代码冻结', desc: '封版', cmd: 'git tag', nodeType: 'start' },
      { name: '灰度发布', desc: '5% 灰度', cmd: 'gray-deploy.sh', nodeType: 'start' },
      { name: '灰度验收', desc: '验证指标', cmd: '', nodeType: 'approve' },
      { name: '全量发布', desc: '100% 上线', cmd: 'full-deploy.sh', nodeType: 'start' },
      { name: '发布确认', desc: '完成确认', cmd: '', nodeType: 'end' },
    ],
  },
  custom: {
    label: '自定义流程',
    color: '#909399',
    icon: 'MagicStick',
    desc: '自由编排任意步骤',
    defaultNodes: [
      { name: '步骤1', desc: '', cmd: '', nodeType: 'start' },
      { name: '步骤2', desc: '', cmd: '', nodeType: 'start' },
    ],
  },
} satisfies Record<FlowType, EngineTypeRegistry[FlowType]>
