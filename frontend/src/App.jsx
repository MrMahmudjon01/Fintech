import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Profile from './pages/Profile'
import Categories from './pages/Categories'
import Debts from './pages/Debts'
import Savings from './pages/Savings'
import Notifications from './pages/Notifications'
import Layout from './components/Layout'

function App() {
  const isAuthenticated = !!localStorage.getItem('access_token');

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
      <Route path="/reset-password" element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/" />} />
      
      {/* Protected Routes inside Layout */}
      <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/savings" element={<Savings />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
    </Routes>
  )
}

export default App
