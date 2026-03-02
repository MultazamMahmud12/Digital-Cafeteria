import { useNavigate } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'

export default function Header({ onLogout, onAdminClick, isAdmin = false }) {
  const navigate = useNavigate()

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">DC</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Digital Cafeteria</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* {!isAdmin && onAdminClick && (
            <button
              onClick={onAdminClick}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Admin Dashboard"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Admin</span>
            </button>
          )} */}

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
