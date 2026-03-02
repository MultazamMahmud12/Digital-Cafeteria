import { useState } from 'react'
import { ShoppingCart, Loader } from 'lucide-react'

const MENU_ITEMS = [
  { itemId: 'biryani_chicken', label: 'Biryani with Chicken' },
  { itemId: 'biryani_veg', label: 'Biryani Vegetarian' },
  { itemId: 'kebab_chicken', label: 'Chicken Kebab' },
  { itemId: 'samosa', label: 'Samosa' },
  { itemId: 'chai', label: 'Chai' },
  { itemId: 'juice', label: 'Fresh Juice' }
]

export default function OrderForm({ onSubmit, disabled }) {
  const [itemId, setItemId] = useState('biryani_chicken')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onSubmit({ itemId, quantity: parseInt(quantity) })
      setQuantity(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Select Item
        </label>
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          disabled={disabled || loading}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50"
        >
          {MENU_ITEMS.map(item => (
            <option key={item.itemId} value={item.itemId}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Quantity
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={disabled || loading}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={disabled || loading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            {loading ? 'Placing...' : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Place Order
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
