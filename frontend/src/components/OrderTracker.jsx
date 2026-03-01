import { CheckCircle2, Clock } from 'lucide-react'

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Pending', description: 'Order received' },
  { key: 'STOCK_VERIFIED', label: 'Verified', description: 'Stock confirmed' },
  { key: 'IN_KITCHEN', label: 'Cooking', description: 'In preparation' },
  { key: 'READY', label: 'Ready', description: 'Ready for pickup' }
]

const STATUS_ORDER = {
  PENDING: 0,
  STOCK_VERIFIED: 1,
  IN_KITCHEN: 2,
  READY: 3
}

export default function OrderTracker({ currentStatus }) {
  const currentIndex = STATUS_ORDER[currentStatus] || 0

  return (
    <div className="py-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute top-6 left-0 right-0 h-1 bg-slate-200">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{
              width: `${(currentIndex / (STATUS_STEPS.length - 1)) * 100}%`
            }}
          ></div>
        </div>

        {/* Status steps */}
        <div className="relative flex justify-between">
          {STATUS_STEPS.map((step, index) => {
            const isComplete = index < currentIndex
            const isActive = index === currentIndex
            const isNext = index > currentIndex

            return (
              <div key={step.key} className="flex flex-col items-center">
                {/* Circle indicator */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    isComplete
                      ? 'bg-blue-600 text-white'
                      : isActive
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : isActive ? (
                    <Clock className="w-6 h-6 animate-pulse" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-current opacity-50"></div>
                  )}
                </div>

                {/* Label and description */}
                <div className="text-center mt-3">
                  <p
                    className={`font-semibold text-sm ${
                      isActive
                        ? 'text-blue-600'
                        : isComplete
                        ? 'text-slate-900'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {currentStatus === 'READY' && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-900 font-semibold">Your order is ready for pickup!</p>
        </div>
      )}
    </div>
  )
}
