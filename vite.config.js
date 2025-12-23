import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        menu: 'src/pages/menu.html',
        admin: 'src/pages/admin.html',
        order: 'src/pages/order.html',
        hostess: 'src/pages/hostess.html',
        reviews: 'src/pages/reviews.html',
        chef: 'src/pages/chef.html',
        login: 'src/pages/login.html',
        table: 'src/pages/table.html',
        room: 'src/pages/room.html',
      },
    },
  },
})