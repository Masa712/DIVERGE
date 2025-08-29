'use client'

import { 
  ChatBubbleLeftRightIcon as MessageSquare,
  CurrencyDollarIcon as DollarSign,
  ChartBarIcon as Activity,
  CalendarIcon as Calendar,
  XMarkIcon as X
} from '@heroicons/react/24/outline'

interface DashboardData {
  totalSessions: number
  totalCost: number
  totalTokens: number
  monthlyUsage: number
}

interface DashboardStatsProps {
  dashboardData: DashboardData
  onClose: () => void
}

export function DashboardStats({ dashboardData, onClose }: DashboardStatsProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-test glass-blur border border-white/20 rounded-lg p-6 max-w-md mx-4 w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Dashboard</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-600">Sessions</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {dashboardData.totalSessions}
            </p>
          </div>

          <div className="bg-white/5 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">Total Cost</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              ${dashboardData.totalCost.toFixed(2)}
            </p>
          </div>

          <div className="bg-white/5 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-600">Tokens</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {dashboardData.totalTokens.toLocaleString()}
            </p>
          </div>

          <div className="bg-white/5 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-gray-600">This Month</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              ${dashboardData.monthlyUsage.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}