import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'nprogress/nprogress.css';
import './assets/nprogress-dark.css';
import './assets/tailwind.css';
import './style.css';
import App from './App.vue';
import router from './router';
import { restoreAuth, validateSession } from './stores/auth';

restoreAuth();

const app = createApp(App);
app.use(ElementPlus);
app.use(router);

void validateSession().finally(() => {
  app.mount('#app');
});
