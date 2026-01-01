# SMART-HOTEL

A modern restaurant management system with digital ordering capabilities.

## Features

- **Customer Interface**: Browse menu and place orders
- **Admin Dashboard**: Manage orders and menu items
- **Hostess Interface**: Monitor table status and orders
- **Real-time Updates**: Live order status tracking

## Tech Stack

- HTML5, CSS3, JavaScript
- Supabase (Backend & Database)
- Font Awesome Icons
- Google Fonts

## Setup Instructions

1. Clone this repository
2. Copy `assets/js/config.example.js` to `assets/js/config.js`
3. Add your Supabase credentials to `config.js`
4. Open `index.html` in your browser

## Live Demo

The project includes a demo configuration that works without setup.

## Project Structure

```
smart-hotel-main/
├── src/
│   ├── assets/
│   │   ├── css/style.css
│   │   ├── js/
│   │   │   ├── config.js (create from .env)
│   │   │   ├── main.js
│   │   │   └── ...
│   │   └── images/
│   └── pages/
│       ├── menu.html
│       ├── admin.html
│       └── ...
├── index.html
├── .env (local only)
└── DEPLOY.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request