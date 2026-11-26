import { createRouter, createWebHistory } from 'vue-router'
import FestivalListPage from '@/pages/FestivalListPage.vue'
import PickPage from '@/pages/PickPage.vue'
import { findFestival } from '@/data/festivals'
import { hydrateFestival, hydrateIndex } from '@/data/festivals/runtime'

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
      beforeEnter: async () => {
        await hydrateIndex()
        return true
      },
    },
    {
      path: '/pick/:festivalId',
      name: 'pick',
      component: PickPage,
      beforeEnter: async (to) => {
        const id = String(to.params.festivalId)
        await hydrateFestival(id)
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
