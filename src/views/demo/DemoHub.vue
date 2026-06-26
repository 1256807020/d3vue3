<template>
  <div class="demo-page">
    <!-- 侧边导航 -->
    <aside class="demo-sidebar">
      <h2>流程引擎 Demo</h2>
      <div class="demo-nav">
        <a v-for="t in tabs" :key="t.key" :class="{ active: activeTab === t.key }"
           @click="activeTab = t.key">{{ t.label }}</a>
      </div>
    </aside>

    <!-- 内容区 -->
    <main class="demo-content">
      <!-- ======== 1. 引擎对比 ======== -->
      <section v-if="activeTab === 'compare'" class="demo-section">
        <h1>业界流程 / 规则 / 任务引擎对比</h1>

        <table class="compare-table">
          <thead>
            <tr><th>引擎类型</th><th>国内方案</th><th>国际方案</th><th>开源</th><th>适用场景</th></tr>
          </thead>
          <tbody>
            <tr><td>审批引擎</td><td>飞书审批、钉钉 OA、企业微信审批</td><td>Camunda, Flowable, jBPM</td><td>✅ Flowable</td><td>请假、报销、合同审批</td></tr>
            <tr><td>规则引擎</td><td>腾讯云规则引擎、阿里业务规则</td><td>Drools, EasyRules, json-rules-engine</td><td>✅ json-rules-engine</td><td>风控、定价、决策树</td></tr>
            <tr><td>任务引擎</td><td>XXL-JOB, DolphinScheduler</td><td>Airflow, Temporal, Prefect</td><td>✅ XXL-JOB</td><td>定时任务、ETL 调度</td></tr>
            <tr><td>消息引擎</td><td>RocketMQ, Pulsar, 腾讯 CMQ</td><td>Kafka, RabbitMQ, NATS</td><td>✅ RocketMQ</td><td>通知、事件驱动、Webhook</td></tr>
            <tr><td>表单引擎</td><td>Formily, 飞书多维表格</td><td>Form.io, JSON Forms</td><td>✅ Formily</td><td>动态表单、字段配置</td></tr>
            <tr><td>数据引擎</td><td>TDengine, StarRocks</td><td>Trino, DuckDB</td><td>✅ DuckDB</td><td>变量传递、上下文存储</td></tr>
          </tbody>
        </table>

        <div class="info-box">
          <strong>选型建议</strong>
          <p>轻量方案：审批用 <em>json-rules-engine</em>（纯 JSON 规则） + 表单用 <em>Formily</em>（JSON Schema 驱动），和你的 D3.js 编排天然兼容。</p>
          <p>企业方案：直接对接飞书/钉钉审批 API，不自己造引擎。</p>
        </div>
      </section>

      <!-- ======== 2. 自动布局 ======== -->
      <section v-else-if="activeTab === 'layout'" class="demo-section">
        <h1>自动布局 — @dagrejs/dagre + D3</h1>
        <p>将杂乱排列的节点自动排列成层次结构</p>
        <div class="demo-bar">
          <el-button type="primary" @click="runAutoLayout">自动排列</el-button>
          <el-button @click="resetLayout">重置</el-button>
        </div>
        <div class="demo-canvas" ref="layoutCanvas">
          <svg ref="layoutSvg" width="100%" height="100%"></svg>
        </div>
      </section>

      <!-- ======== 3. 泳道视图 ======== -->
      <section v-else-if="activeTab === 'swimlane'" class="demo-section">
        <h1>泳道视图 — 按角色分组</h1>
        <p>每个角色一条泳道，节点在其泳道内展示</p>
        <div class="demo-canvas" ref="swimCanvas">
          <svg ref="swimSvg" width="100%" height="100%"></svg>
        </div>
      </section>

      <!-- ======== 4. 缩略图 ======== -->
      <section v-else-if="activeTab === 'minimap'" class="demo-section">
        <h1>缩略图导航 — Minimap</h1>
        <p>左下角展示全局缩略图，点击/拖拽快速导航</p>
        <div class="demo-canvas minimap-container" ref="miniCanvas">
          <svg ref="minimapSvg" width="100%" height="100%"></svg>
          <div class="minimap-panel" ref="minimapPanel">
            <svg ref="minimapMini" width="200" height="150"></svg>
          </div>
        </div>
      </section>

      <!-- ======== 5. 版本对比 ======== -->
      <section v-else-if="activeTab === 'diff'" class="demo-section">
        <h1>版本对比 — JSON Diff</h1>
        <div class="diff-columns">
          <div class="diff-col">
            <h3>版本 A (原始)</h3>
            <el-input type="textarea" :rows="12" v-model="diffA" />
          </div>
          <div class="diff-col">
            <h3>版本 B (修改后)</h3>
            <el-input type="textarea" :rows="12" v-model="diffB" />
          </div>
        </div>
        <div class="demo-bar">
          <el-button type="primary" @click="runDiff">对比差异</el-button>
          <el-button @click="loadSampleDiff">加载示例</el-button>
        </div>
        <div class="diff-result" v-if="diffResult.length">
          <h4>差异 ({{ diffResult.length }} 处)</h4>
          <div v-for="(d, i) in diffResult" :key="i" :class="['diff-item', d.type]">
            <span class="diff-type">{{ d.type === 'added' ? '+' : d.type === 'removed' ? '-' : '~' }}</span>
            <span class="diff-path">{{ d.path }}</span>
            <span class="diff-val">{{ d.value }}</span>
          </div>
        </div>
      </section>

      <!-- ======== 6. 流程模拟 ======== -->
      <section v-else-if="activeTab === 'simulate'" class="demo-section">
        <h1>流程模拟 — 状态机动画</h1>
        <p>单步调试、条件分支可视化</p>
        <div class="demo-bar">
          <el-button type="success" @click="runSimulation">开始模拟</el-button>
          <el-button @click="stepSimulation">单步执行</el-button>
          <el-button type="danger" @click="resetSimulation">重置</el-button>
          <span class="sim-step">步骤: {{ simStep }}/{{ simNodes.length }}</span>
        </div>
        <div class="demo-canvas" ref="simCanvas">
          <svg ref="simSvg" width="100%" height="100%"></svg>
        </div>
      </section>

      <!-- ======== 7. 模板市场 ======== -->
      <section v-else class="demo-section">
        <h1>模板市场 — 社区模板</h1>
        <p>从远程加载社区分享的 JSON 模板</p>
        <div class="market-grid">
          <div v-for="tpl in marketTemplates" :key="tpl.id" class="market-card">
            <h3>{{ tpl.name }}</h3>
            <p>{{ tpl.desc }}</p>
            <div class="market-tags">
              <span class="tag">{{ tpl.type }}</span>
              <span class="tag">{{ tpl.nodes }} 节点</span>
            </div>
            <el-button size="small" type="primary" @click="importMarketTemplate(tpl)">导入</el-button>
          </div>
        </div>
        <div class="demo-bar" v-if="imported">
          <el-button type="success" @click="$router.push(`/pipeline?tpl=${lastImportedId}`)">打开编排器查看</el-button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import * as d3 from 'd3'
import { layout, graphlib } from '@dagrejs/dagre'
import { ElMessage } from 'element-plus'
import { FlowEngine, NODE_TYPES, ENGINE_TYPES } from '../../engine'

const activeTab = ref('compare')

const tabs = [
  { key: 'compare', label: '引擎对比' },
  { key: 'layout', label: '自动布局' },
  { key: 'swimlane', label: '泳道视图' },
  { key: 'minimap', label: '缩略图' },
  { key: 'diff', label: '版本对比' },
  { key: 'simulate', label: '流程模拟' },
  { key: 'market', label: '模板市场' }
]

// ======== 自动布局 ========
const layoutCanvas = ref(null), layoutSvg = ref(null)
let layoutNodes = []
function runAutoLayout() {
  const W = 1200, H = 700
  const g = new graphlib.Graph()
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40, marginx: 40, marginy: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  // 使用默认的 CI/CD 节点
  const names = ['拉取代码','安装依赖','代码构建','运行测试','部署发布']
  names.forEach((n, i) => {
    const target = layoutNodes[i]
    const node = target || { id: i + 1, x: 0, y: 0, width: 180, height: 70, name: n, nodeType: 'start', color: '#409EFF', status: 'idle' }
    g.setNode(String(node.id), { width: node.width, height: node.height })
    if (i > 0) g.setEdge(String(i), String(i + 1))
  })
  layout(g)

  const nodeArr = names.map((n, i) => {
    const pos = g.node(String(i + 1))
    return { id: i + 1, x: pos.x - 90, y: pos.y - 35, width: 180, height: 70, name: n, nodeType: 'start', color: '#409EFF', status: 'idle' }
  })

  layoutNodes = nodeArr
  const svg = d3.select(layoutSvg.value)
  svg.selectAll('*').remove()
  svg.attr('width', W).attr('height', H)

  // 连线
  const edges = []
  for (let i = 1; i < nodeArr.length; i++) {
    const a = nodeArr[i - 1], b = nodeArr[i]
    edges.push({
      path: `M ${a.x + a.width / 2} ${a.y + a.height} L ${a.x + a.width / 2} ${b.y} L ${b.x + b.width / 2} ${b.y} L ${b.x + b.width / 2} ${b.y}`
    })
  }
  svg.selectAll('path.edge').data(edges).enter().append('path')
    .attr('d', d => d.path).attr('stroke','#999').attr('stroke-width',2.5).attr('fill','none')
    .attr('marker-end','url(#arrow)')

  // 节点
  const gs = svg.selectAll('g.node').data(nodeArr).enter().append('g')
    .attr('transform', d => `translate(${d.x},${d.y})`)
  gs.append('rect').attr('width',180).attr('height',70).attr('rx',12).attr('fill',d=>d.color).attr('stroke','#1a6dd4').attr('stroke-width',2)
  gs.append('text').attr('x',90).attr('y',24).attr('text-anchor','middle').attr('fill','#fff').attr('font-size',15).attr('font-weight','bold').text(d=>d.name)
  gs.append('text').attr('x',90).attr('y',48).attr('text-anchor','middle').attr('fill','#fff').attr('font-size',11).attr('opacity',0.8).text('自动布局节点')
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs')
  defs.append('marker').attr('id','arrow').attr('viewBox','0 0 10 10').attr('refX',8).attr('refY',5).attr('markerWidth',7).attr('markerHeight',7).attr('orient','auto').append('path').attr('d','M0 0 L10 5 L0 10 z').attr('fill','#999')

  ElMessage.success('@dagrejs/dagre 自动布局完成')
}
function resetLayout() {
  layoutNodes = []
  d3.select(layoutSvg.value).selectAll('*').remove()
  ElMessage.info('已重置')
}

// ======== 泳道视图 ========
const swimCanvas = ref(null), swimSvg = ref(null)
function drawSwimlane() {
  const svg = d3.select(swimSvg.value)
  svg.selectAll('*').remove()
  svg.attr('width', 1100).attr('height', 500)

  const lanes = [
    { label: '申请人', y: 0, color: '#E3F2FD' },
    { label: '直属上级', y: 140, color: '#E8F5E9' },
    { label: '部门负责人', y: 280, color: '#FFF3E0' },
    { label: '人事', y: 420, color: '#FCE4EC' }
  ]

  // 泳道背景
  lanes.forEach(l => {
    svg.append('rect').attr('x',0).attr('y',l.y).attr('width',1100).attr('height',120).attr('fill',l.color).attr('stroke','#ddd').attr('stroke-width',1)
    svg.append('text').attr('x',20).attr('y',l.y+40).attr('font-size',18).attr('font-weight','bold').attr('fill','#666').text(l.label)
  })

  // 泳道节点
  const nodes = [
    { name:'发起请假', lane:0, x:60, color:'#409EFF' },
    { name:'上级审批', lane:1, x:250, color:'#67C23A' },
    { name:'部门审批', lane:2, x:450, color:'#67C23A' },
    { name:'人事确认', lane:3, x:650, color:'#303133' }
  ]
  nodes.forEach(n => {
    const ly = lanes[n.lane].y + 60
    const g = svg.append('g').attr('transform',`translate(${n.x},${ly})`)
    g.append('rect').attr('width',150).attr('height',50).attr('rx',10).attr('fill',n.color)
    g.append('text').attr('x',75).attr('y',30).attr('text-anchor','middle').attr('fill','#fff').attr('font-weight','bold').text(n.name)
  })

  // 泳道间连线
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1], b = nodes[i]
    const ay = lanes[a.lane].y + 85, by = lanes[b.lane].y + 85
    svg.append('path')
      .attr('d', `M ${a.x + 150} ${ay} L ${a.x + 170} ${ay} L ${b.x - 20} ${by} L ${b.x} ${by}`)
      .attr('stroke','#999').attr('stroke-width',2.5).attr('fill','none')
      .attr('marker-end','url(#sArrow)')
  }
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs')
  defs.append('marker').attr('id','sArrow').attr('viewBox','0 0 10 10').attr('refX',8).attr('refY',5).attr('markerWidth',7).attr('markerHeight',7).attr('orient','auto').append('path').attr('d','M0 0 L10 5 L0 10 z').attr('fill','#999')
}

// ======== 缩略图 ========
const miniCanvas = ref(null), minimapSvg = ref(null), minimapPanel = ref(null), minimapMini = ref(null)
function drawMinimap() {
  const W = 1100, H = 600
  const svg = d3.select(minimapSvg.value).attr('width', W).attr('height', H)
  svg.selectAll('*').remove()

  // 生成散布节点
  const nodes = d3.range(20).map(i => ({
    x: 40 + Math.random() * 1000, y: 40 + Math.random() * 520,
    name: `节点 ${i + 1}`, color: d3.schemeTableau10[i % 10]
  }))

  nodes.forEach(n => {
    svg.append('rect').attr('x',n.x).attr('y',n.y).attr('width',100).attr('height',50).attr('rx',8).attr('fill',n.color)
    svg.append('text').attr('x',n.x+50).attr('y',n.y+30).attr('text-anchor','middle').attr('fill','#fff').attr('font-size',12).text(n.name)
  })

  // 缩略图
  const mini = d3.select(minimapMini.value).attr('width',200).attr('height',150)
  mini.selectAll('*').remove()
  mini.append('rect').attr('width',200).attr('height',150).attr('fill','#f8f9fa').attr('stroke','#ccc')

  const scaleX = 200 / W, scaleY = 150 / H
  nodes.forEach(n => {
    mini.append('rect').attr('x',n.x*scaleX).attr('y',n.y*scaleY).attr('width',12).attr('height',6).attr('fill',n.color)
  })

  // 视口框
  mini.append('rect').attr('class','viewport').attr('x',0).attr('y',0).attr('width',200).attr('height',150)
    .attr('fill','none').attr('stroke','#1E90FF').attr('stroke-width',2).attr('stroke-dasharray','4 2')
}

// ======== 版本对比 ========
const diffA = ref(''), diffB = ref(''), diffResult = ref([])
function loadSampleDiff() {
  const node = { id:1, name:'审批', type:'approve', actions:['通过','驳回'] }
  diffA.value = JSON.stringify(node, null, 2)
  diffB.value = JSON.stringify({...node, name:'部门审批', actions:['通过','驳回','转审'] }, null, 2)
}
function runDiff() {
  try {
    const a = JSON.parse(diffA.value), b = JSON.parse(diffB.value)
    diffResult.value = diffObj(a, b)
  } catch(e) { ElMessage.error('JSON 解析失败: ' + e.message) }
}
function diffObj(a, b, path = '') {
  const changes = []
  if (a === b) return changes
  if (typeof a !== typeof b) { changes.push({ type:'changed', path, value:`${a} → ${b}` }); return changes }
  if (typeof a !== 'object' || a === null) { changes.push({ type:'changed', path, value:`${a} → ${b}` }); return changes }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  keys.forEach(k => {
    const p = path ? `${path}.${k}` : k
    if (!(k in a)) changes.push({ type:'added', path:p, value:JSON.stringify(b[k]) })
    else if (!(k in b)) changes.push({ type:'removed', path:p, value:JSON.stringify(a[k]) })
    else changes.push(...diffObj(a[k], b[k], p))
  })
  return changes
}

// ======== 流程模拟 ========
const simCanvas = ref(null), simSvg = ref(null)
const simStep = ref(0)
const simNodes = ref([])
let simTimer = null
function initSimData() {
  simNodes.value = [
    {id:1,x:50,y:50,name:'发起',color:'#409EFF',status:'idle'},
    {id:2,x:50,y:180,name:'审批',color:'#67C23A',status:'idle'},
    {id:3,x:50,y:310,name:'确认',color:'#303133',status:'idle'}
  ]
}

function runSimulation() {
  if (simNodes.value.length === 0) initSimData()
  resetSimulation()
  simTimer = setInterval(() => {
    if (simStep.value >= simNodes.value.length) { clearInterval(simTimer); return }
    simNodes.value[simStep.value].status = 'running'
    if (simStep.value > 0) simNodes.value[simStep.value - 1].status = 'done'
    simStep.value++
    renderSim()
  }, 1000)
}
function stepSimulation() {
  if (simNodes.value.length === 0) initSimData()
  if (simStep.value >= simNodes.value.length) return
  simNodes.value[simStep.value].status = 'running'
  if (simStep.value > 0) simNodes.value[simStep.value - 1].status = 'done'
  simStep.value++
  renderSim()
}
function resetSimulation() {
  clearInterval(simTimer); simStep.value = 0
  simNodes.value.forEach(n => n.status = 'idle')
  renderSim()
}
function renderSim() {
  if (simNodes.value.length === 0) return
  const svg = d3.select(simSvg.value).attr('width',1100).attr('height',500)
  svg.selectAll('*').remove()
  const gs = svg.selectAll('g').data(simNodes.value).enter().append('g')
    .attr('transform',d=>`translate(${d.x},${d.y})`)
  gs.append('rect').attr('width',170).attr('height',70).attr('rx',12)
    .attr('fill',d=>d.status==='running'?'#E6A23C':d.status==='done'?'#67C23A':d.color).attr('stroke','#333').attr('stroke-width',1.5)
  gs.append('text').attr('x',85).attr('y',25).attr('text-anchor','middle').attr('fill','#fff').attr('font-weight','bold').text(d=>d.name)
  gs.append('text').attr('x',85).attr('y',55).attr('text-anchor','middle').attr('fill','#fff').attr('font-size',11).text(d=>d.status==='running'?'运行中':d.status==='done'?'已完成':'等待中')
  // 连线
  for (let i=1;i<simNodes.value.length;i++) {
    const a=simNodes.value[i-1],b=simNodes.value[i]
    const cls = a.status==='done'&&b.status==='running'?'running':''
    svg.append('path').attr('d',`M ${a.x+85} ${a.y+70} L ${a.x+85} ${b.y} L ${b.x+85} ${b.y}`)
      .attr('stroke',cls?'#1E90FF':'#999').attr('stroke-width',cls?3:2)
      .attr('stroke-dasharray',cls?'8 4':'none').attr('fill','none')
      .attr('marker-end','url(#simArrow)')
  }
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs')
  defs.append('marker').attr('id','simArrow').attr('viewBox','0 0 10 10').attr('refX',8).attr('refY',5).attr('markerWidth',7).attr('markerHeight',7).attr('orient','auto').append('path').attr('d','M0 0 L10 5 L0 10 z').attr('fill','#999')
}

// ======== 模板市场 ========
const marketTemplates = ref([
  { id:'m1', name:'请假审批 (标准)', desc:'提交→审批→确认', type:'approval', nodes:4 },
  { id:'m2', name:'CI/CD 发布', desc:'构建→测试→部署', type:'cicd', nodes:5 },
  { id:'m3', name:'报销审批', desc:'提交→财务→HR', type:'approval', nodes:5 },
  { id:'m4', name:'灰度发布', desc:'灰度→验证→全量', type:'release', nodes:6 },
  { id:'m5', name:'客服工单', desc:'受理→处理→关闭', type:'custom', nodes:4 },
  { id:'m6', name:'合同审批', desc:'起草→法务→高管', type:'approval', nodes:6 }
])
const imported = ref(false)
const lastImportedId = ref('')
function importMarketTemplate(tpl) {
  const template = {
    id: 'mkt-' + tpl.id,
    type: tpl.type,
    name: tpl.name,
    desc: tpl.desc,
    nodes: Array.from({length:tpl.nodes},(_,i)=>({
      id:i+1,x:80,y:80+i*160,width:190,height:84,
      name:`${tpl.name} 步骤${i+1}`,desc:'',cmd:'',
      color: ENGINE_TYPES[tpl.type]?.color || '#409EFF',
      nodeType: i===0?'start':i===tpl.nodes-1?'end':'approve', status:'idle'
    })),
    connections: Array.from({length:tpl.nodes-1},(_,i)=>({
      id:i+1,fromNodeId:i+1,fromPort:'bottom',toNodeId:i+2,toPort:'top',
      action: i===0?'通过':undefined
    }))
  }
  FlowEngine.saveTemplate(template)
  lastImportedId.value = template.id
  ElMessage.success(`已导入「${tpl.name}」到模板列表`)
  imported.value = true
}

// ======== 生命周期 ========
const drawnTabs = new Set()

onMounted(() => {
  nextTick(() => {
    renderTab(activeTab.value)
  })
})

watch(activeTab, (tab) => {
  nextTick(() => {
    renderTab(tab)
  })
})

function renderTab(tab) {
  if (drawnTabs.has(tab)) {
    // 已经绘制过，流程模拟等需要重新初始化
    if (tab === 'simulate' && simNodes.value.length === 0) initSimData()
    return
  }
  drawnTabs.add(tab)
  switch (tab) {
    case 'layout':
      setTimeout(() => runAutoLayout(), 100)
      break
    case 'swimlane':
      setTimeout(() => drawSwimlane(), 100)
      break
    case 'minimap':
      setTimeout(() => drawMinimap(), 100)
      break
    case 'simulate':
      initSimData()
      setTimeout(() => renderSim(), 100)
      break
  }
}
</script>

<style scoped>
.demo-page { display:flex; height:100vh; background:#f5f7fa; }
.demo-sidebar { width:180px; background:#fff; border-right:1px solid #eee; padding:20px 0; flex-shrink:0; }
.demo-sidebar h2 { font-size:16px; padding:0 16px; margin-bottom:16px; color:#303133; }
.demo-nav a { display:block; padding:8px 16px; font-size:13px; color:#666; cursor:pointer; transition:all 0.2s; border-left:3px solid transparent; }
.demo-nav a:hover { color:#1E90FF; background:#f0f7ff; }
.demo-nav a.active { color:#1E90FF; font-weight:600; border-left-color:#1E90FF; background:#f0f7ff; }
.demo-content { flex:1; overflow-y:auto; padding:30px; }
.demo-section h1 { font-size:22px; margin-bottom:16px; }
.demo-section p { color:#666; margin-bottom:20px; }

.compare-table { width:100%; border-collapse:collapse; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05); margin-bottom:20px; }
.compare-table th, .compare-table td { padding:10px 14px; font-size:13px; text-align:left; border-bottom:1px solid #f0f0f0; }
.compare-table th { background:#f8f9fa; font-weight:600; }
.compare-table td:nth-child(4) { color:#67C23A; font-weight:600; }
.info-box { background:#f0f7ff; border-left:4px solid #1E90FF; padding:16px; border-radius:4px; font-size:13px; line-height:1.8; }

.demo-bar { display:flex; gap:10px; align-items:center; margin-bottom:16px; }

.demo-canvas { width:100%; height:600px; background:#fff; border-radius:8px; border:1px solid #eee; position:relative; overflow:hidden; }

.minimap-container { }
.minimap-panel { position:absolute; bottom:12px; right:12px; background:#fff; border-radius:6px; box-shadow:0 2px 12px rgba(0,0,0,0.15); padding:4px; z-index:10; }

.diff-columns { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:12px; }
.diff-result { background:#fff; border-radius:8px; padding:16px; }
.diff-item { display:flex; gap:8px; padding:4px 0; font-size:13px; font-family:monospace; }
.diff-item.added { color:#67C23A; }
.diff-item.removed { color:#F56C6C; }
.diff-item.changed { color:#E6A23C; }
.diff-type { font-weight:bold; min-width:16px; }
.diff-path { color:#666; min-width:120px; }
.diff-val { color:#333; }

.market-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:20px; }
.market-card { background:#fff; border-radius:10px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05); }
.market-card h3 { font-size:15px; margin-bottom:6px; }
.market-card p { font-size:13px; color:#666; margin-bottom:10px; }
.market-tags { display:flex; gap:6px; margin-bottom:12px; }
.market-tags .tag { background:#f0f0f0; padding:2px 8px; border-radius:3px; font-size:11px; color:#666; }
.market-card .el-button { width:100%; }

.sim-step { font-size:14px; color:#409EFF; font-weight:500; }

@media (max-width:768px) {
  .demo-sidebar { width:120px; }
  .market-grid { grid-template-columns:1fr 1fr; }
}
</style>
