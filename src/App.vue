<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const route = useRoute()
// 不同日历共用同一个路由组件，按路径重建页面，确保配置、主题与本地存储都随日历切换
const pageKey = computed(() => route.path)
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view :key="pageKey" />
  </el-config-provider>
</template>
