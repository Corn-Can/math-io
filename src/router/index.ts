import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView // 這將變成「遊戲選擇頁」
    },
    {
      path: '/lobby/:gameId', // 👈 新增這個：特定遊戲的大廳
      name: 'lobby',
      component: () => import('../views/LobbyView.vue') // 等下會建立這個檔案
    },
    {
      path: '/room',
      name: 'room',
      component: () => import('../views/RoomView.vue')
    }
  ]
})

export default router