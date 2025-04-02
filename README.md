# FASTMoney

Financial Management in your Pocket. A full-stack application that allows users to track their finances, split bills with friends, and manage shared expenses.

## 🚀 Features

- **User Authentication**: Secure registration, login, and password management
- **Account Management**: Create and manage multiple financial accounts
- **Transaction Tracking**: Record income and expenses with detailed categorization
- **Bill Splitting**: Split expenses with friends and track who owes what
- **Friend Management**: Add friends and share expenses with them

## 🛠️ Tech Stack

### Backend
- **Framework**: [Next.js](https://nextjs.org/) API Routes
- **Database**: Microsoft SQL Server
- **Authentication**: JWT-based authentication with refresh tokens
- **API Documentation**: OpenAPI/Swagger

### Frontend
- **Framework**: [Next.js](https://nextjs.org/) with App Router

## 📊 Project Status

### Implemented Features

#### Backend
- ✅ Database schema and migrations
- ✅ User authentication (register, login, refresh token, change password)
- ✅ Account management (create, get, edit, delete)
- ✅ Error handling middleware
- ✅ JWT authentication middleware
- ✅ API response utilities
- ✅ Input validation with Zod
- ✅ Friend management system

#### Frontend
- ✅ Project structure and configuration
- ✅ Tailwind CSS setup

### Pending Implementation

#### Backend
- ❌ Transaction management endpoints
- ❌ Bill splitting functionality
- ❌ Transaction tags implementation
- ❌ Database indexes for performance optimization
- ❌ Reporting functionality (Might be switched fully to frontend)

#### Frontend
- ❌ Basic layout components
- ❌ Authentication UI (login, register, password change)
- ❌ Dashboard/home page
- ❌ Account management UI
- ❌ Transaction creation and management
- ❌ Bill splitting UI
- ❌ Friend management UI
- ❌ Reports and analytics
- ❌ Mobile-responsive design
- ❌ Dark/light mode toggle

## 🚦 Getting Started

### Prerequisites

- Node.js (v18+)
- Microsoft SQL Server
- npm or yarn

### Environment Setup

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the environment variables in the `.env` file with your database credentials:

### Installation

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

2. Run database migrations:
   ```bash
   npm run migrate
   # or
   yarn migrate
   ```

3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000) to see the application in action.

## 🧪 Testing

API endpoints can be tested using tools like Postman or through the Swagger documentation.

## 📦 Deployment

The application can be deployed to Vercel, which is optimized for Next.js applications.

## 📝 API Documentation

API documentation is available in the OpenAPI/Swagger format in the `/docs/swagger.json` file.

## 👥 Contributors

- [Muhammad Taha Ali](https://github.com/NotTahaAli)
- [Shayan Qadir](https://github.com/Shayan-Qadir)
- [Ahmed Yasin](https://github.com/Enzoetix)

## 📄 License

This project is currently for academic purposes only at FAST-NUCES Lahore.