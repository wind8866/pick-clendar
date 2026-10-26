import { createRouter, createWebHistory } from 'vue-router'
import PickPage from '@/pages/PickPage.vue'
import { defaultFestivalId, findFestival } from '@/data/festivals'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: () => `/pick/${defaultFestivalId}`,
    },
    {
      path: '/pick/:festivalId',
      name: 'pick',
      component: PickPage,
      beforeEnter: (to) => {
        const id = String(to.params.festivalId)
        return findFestival(id) ? true : { path: `/pick/${defaultFestivalId}`, replace: true }
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: () => `/pick/${defaultFestivalId}`,
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
