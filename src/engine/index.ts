/**
 * FlowEngine 模块统一导出
 *
 * 使用方式:
 *   import { FlowEngine, NODE_TYPES, ENGINE_TYPES, ACTIONS, COLORS, GRID_SIZE } from '@/engine'
 *
 * 兼容旧版导入:
 *   import { FlowEngine, NODE_TYPES, ENGINE_TYPES } from '../engine/base.js'
 *   → 改为 import { FlowEngine, NODE_TYPES, ENGINE_TYPES } from '../engine'
 */

export { FlowEngine, EventEmitter } from './FlowEngine'
export {
  STORAGE_KEY,
  GRID_SIZE,
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_RADIUS,
  PORT_RADIUS,
  PATH_GAP,
  PATH_SNAP_THRESHOLD,
  PORT_BEND_PENALTY,
  CONN_HIT_TOLERANCE,
  VIRTUAL_W,
  VIRTUAL_H,
  DEFAULT_VIEW_W,
  DEFAULT_VIEW_H,
  GRID_OFFSET,
  GRID_EXTRA,
  MIN_ZOOM_W,
  ZOOM_STEP,
  ZOOM_DEBOUNCE,
  ZOOM_DURATION,
  FIT_DURATION,
  RESET_DURATION,
  ZOOM_BASE_W,
  PAN_MIN,
  EXECUTION_INTERVAL,
  STEP_DELAY,
  END_NODE_DURATION,
  MAX_EXECUTION_STEPS,
  COLORS,
  ACTIONS,
  NODE_TYPES,
  NODE_STATES,
  VALID_TRANSITIONS,
  FLOW_STATES,
  DEFAULT_APPROVE_MODE,
  DEFAULT_OPERATOR,
  ENGINE_TYPES,
} from './constants'

export type {
  NodeId,
  ConnId,
  FlowId,
  ActionLabel,
  PortDirection,
  PortPosition,
  NodeShape,
  NodeTypeDef,
  NodeTypeRegistry,
  NodeStatus,
  FlowNode,
  FlowConnection,
  FlowType,
  FlowStatus,
  FlowDefinition,
  ApproveMode,
  FlowContext,
  FlowHistoryEntry,
  ApprovalDecision,
  FlowSnapshot,
  FlowTemplate,
  PortScore,
  NodeTransitionMap,
  EngineTypeDef,
  EngineTypeRegistry,
} from './types'
