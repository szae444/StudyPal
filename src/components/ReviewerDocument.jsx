import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
    normalizeReviewerMarkdown, remarkHighlight, rehypeReviewer, fitWideMath, contrastText,
} from '../utils/reviewerMarkdown';

const remarkPlugins = [remarkGfm, remarkMath, remarkHighlight];
// A formula KaTeX can't parse renders in red instead of breaking the whole reviewer.
const rehypePlugins = [[rehypeKatex, { throwOnError: false, strict: 'ignore' }], rehypeReviewer];

/**
 * A generated reviewer, laid out as a printable study document.
 * `columns` is 1 or 2; `accent` is an optional #rrggbb colour for the topic bars.
 * The ref exposes the rendered <article> for printing.
 */
const ReviewerDocument = forwardRef(function ReviewerDocument({ markdown, columns = 2, accent }, ref) {
    const articleRef = useRef(null);
    useImperativeHandle(ref, () => articleRef.current, []);

    const source = useMemo(() => normalizeReviewerMarkdown(markdown), [markdown]);

    useLayoutEffect(() => {
        fitWideMath(articleRef.current, columns);
    }, [source, columns]);

    // KaTeX's fonts change formula widths once they load, so measure again then.
    useEffect(() => {
        let cancelled = false;
        document.fonts?.ready.then(() => { if (!cancelled) fitWideMath(articleRef.current, columns); });
        return () => { cancelled = true; };
    }, [source, columns]);

    const accentText = contrastText(accent);
    const style = accent && accentText ? { '--rv-accent': accent, '--rv-on-accent': accentText } : undefined;

    return (
        <article ref={articleRef} className={`rv-doc cols-${columns}`} style={style}>
            <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
                {source}
            </ReactMarkdown>
        </article>
    );
});

/**
 * 1 / 2 column switch for a reviewer.
 */
export function ColumnToggle({ columns, setColumns }) {
    return (
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {[1, 2].map(n => (
                <button
                    key={n}
                    onClick={() => setColumns(n)}
                    aria-pressed={columns === n}
                    style={{
                        padding: '0.3rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: columns === n ? 'var(--accent-primary)' : 'transparent',
                        color: columns === n ? 'var(--bg-primary)' : 'var(--text-muted)',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {n === 1 ? '1 Column' : '2 Columns'}
                </button>
            ))}
        </div>
    );
}

export default ReviewerDocument;
