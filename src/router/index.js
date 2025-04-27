import { createRouter, createWebHashHistory } from "vue-router";

// 导入视图组件
import Demo3 from "../components/Demo3.vue";
import Demo2 from "../components/Demo2.vue";
import Demo from "../components/Demo.vue";
import ScreenshotView from "../views/ScreenshotView.vue";

// 定义路由
const routes = [{
        path: "/",
        redirect: "/model-viewer",
    },

    {
        path: "/Demo2",
        name: "Demo2",
        component: Demo2,
        meta: {
            title: "模型查看器",
        },
    },
    {
        path: "/Demo",
        name: "Demo",
        component: Demo,
        meta: {
            title: "模型查看器",
        },
    },
    {
        path: "/model-viewer",
        name: "ModelViewer",
        component: Demo3,
        meta: {
            title: "3D模型查看器",
        },
    },
    {
        path: "/screenshots",
        name: "Screenshots",
        component: ScreenshotView,
        meta: {
            title: "截图管理",
        },
    },
    // 捕获所有未匹配的路由，重定向到首页
    {
        path: "/:pathMatch(.*)*",
        redirect: "/",
    },
];

// 创建路由实例
const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

// 全局前置守卫，设置页面标题
router.beforeEach((to, from, next) => {
    // 设置页面标题
    document.title = to.meta.title ?
        `${to.meta.title} - 模型查看器` :
        "模型查看器";
    next();
});

export default router;