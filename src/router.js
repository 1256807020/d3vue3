import { createRouter, createWebHistory } from 'vue-router'
import PipelineEditor from './views/PipelineEditor.vue'
import FlowList from './views/flow/FlowList.vue'
import DemoHub from './views/demo/DemoHub.vue'

const routes = [
  { path: '/', name: 'Home', redirect: '/pipeline' },
  { path: '/pipeline', name: 'PipelineEditor', component: PipelineEditor },
  { path: '/flow', name: 'FlowList', component: FlowList },
  { path: '/demo', name: 'DemoHub', component: DemoHub }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
