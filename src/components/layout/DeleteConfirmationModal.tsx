'use client'

interface DeleteConfirmationModalProps {
  sessionId: string | null
  onConfirm: (sessionId: string) => void
  onCancel: () => void
}

export function DeleteConfirmationModal({ sessionId, onConfirm, onCancel }: DeleteConfirmationModalProps) {
  if (!sessionId) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-test glass-blur border border-white/20 rounded-lg p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Delete Session
        </h3>
        <p className="text-sm text-gray-700 mb-4">
          Are you sure you want to delete this chat session? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(sessionId)}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}