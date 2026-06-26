<template>
  <!--
    流程模板列表页 — 管理所有流程模板的 CRUD
    - 按类型筛选
    - 新建/编辑/删除/运行流程
    - 跳转编辑器
  -->
  <div class="flow-list-page">
    <div class="container" style="padding: 24px 0;">

      <!-- 页面标题 -->
      <div class="page-header">
        <div>
          <h1>流程模板管理</h1>
          <p class="subtitle">创建和管理 CI/CD、审批、发布等各类流程模板</p>
        </div>
        <el-button type="primary" size="large" @click="showCreateDialog">
          <el-icon style="margin-right:6px"><Plus /></el-icon>新建流程模板
        </el-button>
      </div>

      <!-- 类型筛选 -->
      <div class="filter-row">
        <span class="filter-label">流程类型:</span>
        <el-radio-group v-model="filterType" size="small" @change="loadTemplates">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button v-for="(info, key) in ENGINE_TYPES" :key="key" :value="key">
            {{ info.label }}
          </el-radio-button>
        </el-radio-group>
        <span class="count-tip">共 {{ filteredTemplates.length }} 个模板</span>
      </div>

      <!-- 模板卡片网格 -->
      <div class="template-grid" v-if="filteredTemplates.length > 0">
        <div v-for="tpl in filteredTemplates" :key="tpl.id" class="template-card">
          <!-- 卡片头部 -->
          <div class="card-header" :style="{ background: getTypeInfo(tpl.type).color }">
            <span class="card-type-badge">{{ getTypeInfo(tpl.type).label }}</span>
            <el-dropdown trigger="click" @command="(cmd) => handleCardAction(cmd, tpl)">
              <el-button text circle size="small" style="color:#fff">
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑流程</el-dropdown-item>
                  <el-dropdown-item command="run">运行流程</el-dropdown-item>
                  <el-dropdown-item command="export">导出 JSON</el-dropdown-item>
                  <el-dropdown-item command="duplicate">复制模板</el-dropdown-item>
                  <el-dropdown-item command="delete" divided style="color:#F56C6C">删除模板</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <!-- 卡片内容 -->
          <div class="card-body">
            <h3 class="card-title">{{ tpl.name }}</h3>
            <p class="card-desc">{{ tpl.desc || '暂无描述' }}</p>

            <!-- 统计信息 -->
            <div class="card-stats">
              <span><el-icon><Cpu /></el-icon> {{ tpl.nodes?.length || 0 }} 步骤</span>
              <span><el-icon><Connection /></el-icon> {{ tpl.connections?.length || 0 }} 连线</span>
              <span class="card-date">{{ formatDate(tpl.updatedAt || tpl.createdAt) }}</span>
            </div>
          </div>

          <!-- 卡片底部操作 -->
          <div class="card-footer">
            <el-button size="small" @click="editTemplate(tpl)">编辑</el-button>
            <el-button size="small" type="success" @click="runTemplate(tpl)">
              <el-icon style="margin-right:4px"><VideoPlay /></el-icon>运行
            </el-button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <el-empty v-else description="还没有流程模板" :image-size="160">
        <el-button type="primary" @click="showCreateDialog">创建第一个流程模板</el-button>
      </el-empty>
    </div>

    <!-- 新建/编辑模板弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑流程模板' : '新建流程模板'"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-position="top">
        <el-form-item label="模板名称" required>
          <el-input v-model="form.name" placeholder="如: 前端发布流程" maxlength="30" />
        </el-form-item>
        <el-form-item label="流程类型" required>
          <el-select v-model="form.type" style="width:100%" @change="onTypeChange">
            <el-option
              v-for="(info, key) in ENGINE_TYPES"
              :key="key" :label="info.label" :value="key"
            >
              <span :style="{ color: info.color, fontWeight: 600 }">●</span> {{ info.label }} — {{ info.desc }}
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.desc" type="textarea" :rows="3" placeholder="描述此流程的用途" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">
          {{ isEditing ? '保存修改' : '创建并进入编辑' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 运行确认弹窗 -->
    <el-dialog v-model="runDialogVisible" title="确认运行" width="400px">
      <div style="text-align:center">
        <p style="font-size:16px; margin-bottom:12px">
          <strong>{{ runningTemplate?.name }}</strong>
        </p>
        <p style="color:#666">{{ runningTemplate?.nodes?.length || 0 }} 个步骤，将按拓扑顺序依次执行</p>
      </div>
      <template #footer>
        <el-button @click="runDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRun">开始运行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MoreFilled, Cpu, Connection, VideoPlay } from '@element-plus/icons-vue'
import { FlowEngine, ENGINE_TYPES, NODE_TYPES } from '../../engine'

const router = useRouter()

// ==================== 状态 ====================

const filterType = ref('all')
const templates = ref([])
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const runDialogVisible = ref(false)
const runningTemplate = ref(null)

const form = ref({
  name: '',
  type: 'cicd',
  desc: ''
})

const filteredTemplates = computed(() => {
  if (filterType.value === 'all') return templates.value
  return templates.value.filter(t => t.type === filterType.value)
})

// ==================== 初始化 ====================

function loadTemplates() {
  templates.value = FlowEngine.loadTemplates()
}

onMounted(() => {
  loadTemplates()
  // 首次使用时，预置一个默认模板
  if (templates.value.length === 0) {
    seedDefaultTemplates()
  }
})

/** 预设默认模板 */
function seedDefaultTemplates() {
  // CI/CD 预设
  const cicdFlow = {
    id: 'cicd-default',
    type: 'cicd',
    name: '前端 CI/CD 管线',
    desc: '前端项目的标准持续集成/持续部署流程',
    nodes: [
      { id: 1, x: 80, y: 80, width: 190, height: 84, name: 'Git 拉取代码', desc: '从代码仓库拉取', cmd: 'git pull', color: '#409EFF', nodeType: 'start', status: 'idle' },
      { id: 2, x: 80, y: 220, width: 190, height: 84, name: '依赖安装', desc: '安装项目依赖', cmd: 'npm install', color: '#409EFF', nodeType: 'start', status: 'idle' },
      { id: 3, x: 80, y: 360, width: 190, height: 84, name: '代码构建', desc: '项目编译构建', cmd: 'npm run build', color: '#409EFF', nodeType: 'start', status: 'idle' },
      { id: 4, x: 80, y: 500, width: 190, height: 84, name: '运行测试', desc: '单元/集成测试', cmd: 'npm test', color: '#67C23A', nodeType: 'start', status: 'idle' },
      { id: 5, x: 80, y: 640, width: 190, height: 84, name: '部署发布', desc: '发布上线', cmd: 'deploy.sh', color: '#E6A23C', nodeType: 'end', status: 'idle' }
    ],
    connections: [
      { id: 1, fromNodeId: 1, fromPort: 'bottom', toNodeId: 2, toPort: 'top' },
      { id: 2, fromNodeId: 2, fromPort: 'bottom', toNodeId: 3, toPort: 'top' },
      { id: 3, fromNodeId: 3, fromPort: 'bottom', toNodeId: 4, toPort: 'top' },
      { id: 4, fromNodeId: 4, fromPort: 'bottom', toNodeId: 5, toPort: 'top' }
    ]
  }

  // 审批流预设
  const approvalFlow = {
    id: 'approval-default',
    type: 'approval',
    name: '请假审批流程',
    desc: '完整审批: 发起→直属审批→(驳回→修改→重填→重审)循环→部门审批→人事确认',
    nodes: [
      { id: 1, x: 80, y: 40,  width: 210, height: 90, name: '发起请假申请', desc: '填写请假表单', cmd: '', color: '#409EFF', nodeType: 'start', status: 'idle' },
      { id: 2, x: 80, y: 200, width: 210, height: 90, name: '直属上级审批', desc: 'Leader 审批(通过/驳回)', cmd: '', color: '#67C23A', nodeType: 'approve', status: 'idle' },
      { id: 3, x: 80, y: 360, width: 210, height: 90, name: '驳回修改', desc: '查看驳回意见', cmd: '', color: '#E6A23C', nodeType: 'modify', status: 'idle' },
      { id: 4, x: 80, y: 510, width: 210, height: 90, name: '重新填写表单', desc: '补充资料/附件后重交', cmd: '', color: '#E6A23C', nodeType: 'modify', status: 'idle' },
      { id: 5, x: 420, y: 200, width: 210, height: 90, name: '部门负责人审批', desc: '部门 Boss 审批', cmd: '', color: '#67C23A', nodeType: 'approve', status: 'idle' },
      { id: 6, x: 420, y: 360, width: 210, height: 90, name: '人事考勤确认', desc: 'HR 归档', cmd: '', color: '#303133', nodeType: 'end', status: 'idle' }
    ],
    connections: [
      { id: 1, fromNodeId: 1, fromPort: 'bottom', toNodeId: 2, toPort: 'top', action: '通过' },
      { id: 2, fromNodeId: 2, fromPort: 'bottom', toNodeId: 3, toPort: 'top', action: '驳回' },
      { id: 3, fromNodeId: 2, fromPort: 'right',  toNodeId: 5, toPort: 'top', action: '通过' },
      { id: 4, fromNodeId: 3, fromPort: 'bottom', toNodeId: 4, toPort: 'top', action: '继续' },
      { id: 5, fromNodeId: 4, fromPort: 'right',  toNodeId: 2, toPort: 'left', action: '重新提交' },
      { id: 6, fromNodeId: 5, fromPort: 'bottom', toNodeId: 6, toPort: 'top', action: '通过' }
    ]
  }

  FlowEngine.saveTemplate(cicdFlow)
  FlowEngine.saveTemplate(approvalFlow)
  loadTemplates()
}

// ==================== 辅助函数 ====================

function getTypeInfo(type) {
  return ENGINE_TYPES[type] || ENGINE_TYPES.custom
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function onTypeChange() {
  // 类型变更时更新默认名称
  if (!isEditing.value) {
    const info = getTypeInfo(form.value.type)
    form.value.name = ''
    form.value.desc = info.desc
  }
}

// ==================== CRUD ====================

function showCreateDialog() {
  isEditing.value = false
  editingId.value = null
  form.value = { name: '', type: 'cicd', desc: '' }
  dialogVisible.value = true
}

function editTemplate(tpl) {
  isEditing.value = true
  editingId.value = tpl.id
  form.value = { name: tpl.name, type: tpl.type, desc: tpl.desc || '' }
  dialogVisible.value = true
}

function saveTemplate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }

  let template
  if (isEditing.value) {
    const existing = templates.value.find(t => t.id === editingId.value)
    template = {
      ...existing,
      name: form.value.name,
      type: form.value.type,
      desc: form.value.desc
    }
  } else {
    // 新建 → 创建默认节点模板
    const typeInfo = ENGINE_TYPES[form.value.type] || ENGINE_TYPES.custom
    const defaultNodes = typeInfo.defaultNodes || []
    template = {
      id: Date.now().toString(36),
      type: form.value.type,
      name: form.value.name,
      desc: form.value.desc,
      nodes: defaultNodes.map((n, i) => ({
        id: i + 1,
        x: 80,
        y: 80 + i * 160,
        width: 190,
        height: 84,
        name: n.name,
        desc: n.desc,
        cmd: n.cmd || '',
        nodeType: n.nodeType || 'start',
        color: typeInfo.color,
        status: 'idle'
      })),
      connections: defaultNodes.slice(1).map((_, i) => ({
        id: i + 1,
        fromNodeId: i + 1,
        fromPort: 'bottom',
        toNodeId: i + 2,
        toPort: 'top'
      }))
    }
  }

  FlowEngine.saveTemplate(template)
  loadTemplates()
  dialogVisible.value = false
  ElMessage.success(isEditing.value ? '模板已更新' : '模板已创建')

  // 新建后直接跳转到编辑器
  if (!isEditing.value) {
    router.push({ name: 'PipelineEditor', query: { tpl: template.id } })
  }
}

function handleCardAction(cmd, tpl) {
  switch (cmd) {
    case 'edit': editTemplate(tpl); break
    case 'run': runTemplate(tpl); break
    case 'export': exportTemplate(tpl); break
    case 'duplicate': duplicateTemplate(tpl); break
    case 'delete': deleteTemplate(tpl); break
  }
}

function runTemplate(tpl) {
  runningTemplate.value = tpl
  runDialogVisible.value = true
}

function confirmRun() {
  runDialogVisible.value = false
  if (runningTemplate.value) {
    router.push({ name: 'PipelineEditor', query: { tpl: runningTemplate.value.id, run: '1' } })
  }
}

/** 导出模板 JSON */
function exportTemplate(tpl) {
  const json = JSON.stringify(tpl, null, 2)
  navigator.clipboard.writeText(json).then(() => {
    ElMessage.success('模板 JSON 已复制到剪贴板')
  }).catch(() => {
    ElMessage.warning('复制失败, 请手动复制')
    // fallback: 显示在 prompt 中
    prompt('模板 JSON (请手动复制):', json)
  })
}

/** 复制模板 */
function duplicateTemplate(tpl) {
  const copy = {
    ...tpl,
    id: Date.now().toString(36),
    name: tpl.name + ' (副本)',
    nodes: tpl.nodes.map(n => ({ ...n, status: 'idle' })),
    connections: tpl.connections.map(c => ({ ...c }))
  }
  FlowEngine.saveTemplate(copy)
  loadTemplates()
  ElMessage.success('模板已复制')
}

function deleteTemplate(tpl) {
  ElMessageBox.confirm(
    `确定删除模板「${tpl.name}」吗？此操作不可恢复。`,
    '确认删除',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    FlowEngine.deleteTemplate(tpl.id)
    loadTemplates()
    ElMessage.success('模板已删除')
  }).catch(() => {})
}
</script>

<style scoped>
.flow-list-page {
  min-height: 100vh;
  background: #f5f7fa;
}

/* 页面头部 */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 0;
}

.subtitle {
  color: #909399;
  font-size: 14px;
  margin-top: 4px;
}

/* 筛选行 */
.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
}

.filter-label {
  font-size: 13px;
  color: #909399;
  flex-shrink: 0;
}

.count-tip {
  font-size: 12px;
  color: #bbb;
  margin-left: auto;
}

/* 模板卡片网格 */
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.template-card {
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: all 0.2s;
  cursor: default;
}

.template-card:hover {
  box-shadow: 0 6px 20px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  color: #fff;
}

.card-type-badge {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.9;
}

.card-body {
  padding: 20px 16px 16px;
}

.card-title {
  font-size: 17px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px;
}

.card-desc {
  font-size: 13px;
  color: #909399;
  margin: 0 0 16px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
}

.card-stats span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.card-date {
  margin-left: auto;
}

.card-footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.card-footer .el-button {
  flex: 1;
}
</style>
