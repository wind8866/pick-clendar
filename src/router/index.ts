import { createRouter, createWebHistory } from 'vue-router'
import FestivalListPage from '@/pages/FestivalListPage.vue'
import PickPage from '@/pages/PickPage.vue'
import { findFestival } from '@/data/festivals'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/pick',
    },
    {
      path: '/pick',
      name: 'festival-list',
      component: FestivalListPage,
    },
    {
      path: '/pick/:festivalId',
      name: 'pick',
      component: PickPage,
      beforeEnter: (to) => {
        const id = String(to.params.festivalId)
        return findFestival(id) ? true : { path: '/pick', replace: true }
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/pick',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
