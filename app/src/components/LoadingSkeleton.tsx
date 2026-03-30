export function LoadingSkeleton() {
  return (
    <div className="pt-20 min-h-screen" style={{ background: '#0a0a0a' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header skeleton */}
        <div className="skeleton h-3 w-40 mb-4" />
        <div className="skeleton h-12 w-96 mb-3" />
        <div className="skeleton h-12 w-72 mb-6" />
        <div className="skeleton h-5 w-[500px] mb-8" />

        {/* Cards skeleton */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(224,224,224,0.04)' }}>
              <div className="skeleton h-3 w-24 mb-3" />
              <div className="skeleton h-8 w-20 mb-2" />
              <div className="skeleton h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(224,224,224,0.04)' }}>
            <div className="skeleton h-4 w-48 mb-4" />
            <div className="skeleton h-[200px] w-full mb-3" />
            <div className="skeleton h-3 w-full mb-2" />
            <div className="skeleton h-3 w-3/4" />
          </div>
          <div className="rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(224,224,224,0.04)' }}>
            <div className="skeleton h-4 w-48 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-3">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton h-3 flex-1" />
                  <div className="skeleton h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
