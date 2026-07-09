import { createRouter, createWebHistory } from 'vue-router'
import MapView from './views/MapView.vue'
import AdminView from './views/AdminView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'map', component: MapView },
    { path: '/admin', name: 'admin', component: AdminView },
  ],
})

export default router
