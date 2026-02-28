import { useState, useEffect } from 'react';

/**
 * Hook to detect media query match.
 * @param {string} query - CSS media query string, e.g. '(max-width: 768px)'
 * @returns {boolean}
 */
export function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia(query).matches;
        }
        return false;
    });

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = (e) => setMatches(e.matches);
        mql.addEventListener('change', handler);
        setMatches(mql.matches);
        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return matches;
}
