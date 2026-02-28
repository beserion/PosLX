import Skeleton, { CardSkeleton } from '../ui/Skeleton';

export default function DashboardSkeleton() {
    return (
        <div className="flex flex-col gap-5">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Skeleton width="130px" height="24px" />
                    <Skeleton width="50px" height="20px" variant="card" />
                </div>
                <Skeleton width="200px" height="14px" />
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CardSkeleton />
                <CardSkeleton />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass-card-static p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <Skeleton variant="circle" width="36px" height="36px" />
                        <div>
                            <Skeleton width="120px" height="14px" className="mb-1" />
                            <Skeleton width="80px" height="10px" />
                        </div>
                    </div>
                    <Skeleton variant="chart" width="100%" height="160px" />
                </div>
                <div className="glass-card-static p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <Skeleton variant="circle" width="36px" height="36px" />
                        <div>
                            <Skeleton width="140px" height="14px" className="mb-1" />
                            <Skeleton width="100px" height="10px" />
                        </div>
                    </div>
                    <Skeleton variant="chart" width="100%" height="160px" />
                </div>
            </div>
        </div>
    );
}
