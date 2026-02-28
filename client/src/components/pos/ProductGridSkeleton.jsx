import Skeleton, { ProductCardSkeleton } from '../ui/Skeleton';

export default function ProductGridSkeleton() {
    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Category tabs skeleton */}
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} width={`${60 + i * 10}px`} height="36px" variant="card" />
                ))}
            </div>

            {/* Product grid skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 flex-1">
                {Array.from({ length: 8 }, (_, i) => (
                    <ProductCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
