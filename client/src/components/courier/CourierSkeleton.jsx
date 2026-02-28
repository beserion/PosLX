import Skeleton from '../ui/Skeleton';

export default function CourierSkeleton() {
    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-2rem)]">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Skeleton width="160px" height="24px" />
                <Skeleton width="70px" height="20px" variant="card" />
            </div>

            <div className="flex gap-4 flex-1 min-h-0">
                {/* Map skeleton */}
                <div className="flex-1 min-w-0">
                    <Skeleton variant="chart" width="100%" height="100%" className="min-h-[400px]" />
                </div>

                {/* Courier cards skeleton */}
                <div className="w-[320px] shrink-0 flex flex-col gap-3">
                    <Skeleton width="120px" height="12px" />
                    {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="glass-card-static p-4 flex items-center gap-4">
                            <Skeleton variant="circle" width="44px" height="44px" />
                            <div className="flex-1">
                                <Skeleton width="80%" height="14px" className="mb-2" />
                                <Skeleton width="60%" height="10px" />
                            </div>
                            <Skeleton width="60px" height="20px" variant="card" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
