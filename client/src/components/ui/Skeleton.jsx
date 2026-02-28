import { motion } from 'framer-motion';

/**
 * Reusable skeleton loading component with shimmer animation.
 * @param {'text'|'card'|'circle'|'chart'} variant
 */
export default function Skeleton({
    width = '100%',
    height = '16px',
    variant = 'text',
    className = '',
    count = 1,
}) {
    const baseStyle = {
        width,
        height,
        borderRadius:
            variant === 'circle' ? '50%' :
                variant === 'card' ? '16px' :
                    variant === 'chart' ? '12px' : '8px',
    };

    const items = Array.from({ length: count }, (_, i) => i);

    return (
        <>
            {items.map((i) => (
                <div
                    key={i}
                    className={`skeleton ${className}`}
                    style={{ ...baseStyle, marginBottom: count > 1 ? 8 : 0 }}
                />
            ))}
        </>
    );
}

/** Pre-built skeleton for a glass card */
export function CardSkeleton({ className = '' }) {
    return (
        <div className={`glass-card-static p-5 ${className}`}>
            <div className="flex items-center gap-3 mb-4">
                <Skeleton variant="circle" width="36px" height="36px" />
                <Skeleton width="120px" height="12px" />
            </div>
            <Skeleton width="60%" height="24px" className="mb-2" />
            <Skeleton width="40%" height="12px" />
        </div>
    );
}

/** Pre-built skeleton for a product card */
export function ProductCardSkeleton() {
    return (
        <div className="glass-card-static p-4 flex flex-col items-center gap-2">
            <Skeleton variant="circle" width="48px" height="48px" />
            <Skeleton width="80%" height="14px" />
            <Skeleton width="50%" height="16px" />
        </div>
    );
}
