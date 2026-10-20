/**
 * Markdown → reviewer document helpers.
 *
 * The `ai` function writes reviewers in a small house dialect of GitHub-flavored Markdown
 * (see REVIEWER_STYLE in functions/index.js):
 *   ==text==                       highlighter
 *   > [!HIGHYIELD] Optional title  typed callouts (HIGHYIELD, PEARL, MNEMONIC, PITFALL,
 *   > ...                          FORMULA, EXAMPLE, CHECK, NOTE)
 *   - Question? → answer           inside a CHECK callout, the answer is hidden until tapped
 *
 * These helpers turn that into a document with numbered topic sections, so the renderer and
 * print stylesheet can lay it out without anything overlapping. Old saved reviewers, which used
 * plain blockquotes, numbered headings and <mark> tags, go through the same path.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Text clean-up (runs before parsing)
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_ROW = /^\s*(?:>\s*)*\|/;

/**
 * Fix the Markdown slips that make a rendered reviewer look broken.
 */
export const normalizeReviewerMarkdown = (markdown) => {
    let md = String(markdown || '').replace(/\r\n?/g, '\n');

    // Raw HTML isn't rendered, so turn the tags models like to use into Markdown or plain text.
    md = md
        .replace(/<mark>([\s\S]*?)<\/mark>/gi, '==$1==')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/?(?:b|strong|i|em|u|span|font|sup|sub|small|center|div|p)(?:\s[^>]*)?>/gi, '')
        // An empty heading ("####" with nothing after it) renders as a stray rule.
        .replace(/^[ \t]*#{1,6}[ \t]*$/gm, '');

    const lines = md.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const prev = out.length ? out[out.length - 1] : '';

        // A table glued to the paragraph above it is parsed as text, so give it a blank line.
        if (TABLE_ROW.test(line) && prev.trim() !== '' && !TABLE_ROW.test(prev) && /^\s*\|?\s*:?-{2,}/.test((lines[i + 1] || '').replace(/^\s*(?:>\s*)*/, ''))) {
            const quote = line.match(/^\s*((?:>\s*)*)/)[1];
            out.push(quote.trimEnd());
        }

        // Padded separators ("|:--------|") and runaway rows from older reviewers.
        if (TABLE_ROW.test(line)) {
            out.push(line.replace(/(:?)-{4,}(:?)/g, '$1---$2').replace(/ {2,}/g, ' ').replace(/(.)\1{200,}/g, '$1$1$1'));
            continue;
        }

        // "$$ x = y $$" on one line → a display block, which KaTeX centers and sizes properly.
        const oneLineMath = line.match(/^(\s*(?:>\s*)*)\$\$(.+?)\$\$\s*$/);
        if (oneLineMath && oneLineMath[2].trim()) {
            const quote = oneLineMath[1];
            out.push(`${quote}$$`, `${quote}${oneLineMath[2].trim()}`, `${quote}$$`);
            continue;
        }
        out.push(line);
    }
    return out.join('\n');
};

// ─────────────────────────────────────────────────────────────────────────────
// Tree helpers
// ─────────────────────────────────────────────────────────────────────────────

const SKIP_MDAST = new Set(['code', 'inlineCode', 'math', 'inlineMath']);

const isElement = (node, tagName) => node?.type === 'element' && (!tagName || node.tagName === tagName);

const classList = (node) => {
    const value = node.properties?.className;
    return Array.isArray(value) ? value : value ? String(value).split(' ') : [];
};

const hasClass = (node, name) => classList(node).includes(name);

const el = (tagName, className, children = [], properties = {}) => ({
    type: 'element',
    tagName,
    properties: { ...(className ? { className: Array.isArray(className) ? className : [className] } : {}), ...properties },
    children,
});

const textOf = (node) => {
    if (!node) return '';
    if (node.type === 'text') return node.value;
    return (node.children || []).map(textOf).join('');
};

const walk = (node, fn, parent = null) => {
    fn(node, parent);
    for (const child of node.children || []) walk(child, fn, node);
};

// ─────────────────────────────────────────────────────────────────────────────
// remark: ==highlight==
// ─────────────────────────────────────────────────────────────────────────────

const HIGHLIGHT = /==([^=\n](?:[^\n]*?[^=\n])?)==/g;

/**
 * remark plugin: `==text==` → <mark>text</mark>.
 */
export function remarkHighlight() {
    return (tree) => {
        const visit = (node) => {
            if (!node.children || SKIP_MDAST.has(node.type)) return;
            const next = [];
            for (const child of node.children) {
                if (child.type !== 'text' || !child.value.includes('==')) {
                    visit(child);
                    next.push(child);
                    continue;
                }
                let last = 0;
                for (const match of child.value.matchAll(HIGHLIGHT)) {
                    if (match.index > last) next.push({ type: 'text', value: child.value.slice(last, match.index) });
                    next.push({ type: 'highlight', data: { hName: 'mark' }, children: [{ type: 'text', value: match[1] }] });
                    last = match.index + match[0].length;
                }
                if (last < child.value.length) next.push({ type: 'text', value: child.value.slice(last) });
            }
            node.children = next;
        };
        visit(tree);
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// rehype: callouts, check answers, tables, sections, contents
// ─────────────────────────────────────────────────────────────────────────────

export const CALLOUT_LABELS = {
    note: 'Note',
    highyield: 'High-yield',
    pearl: 'Pearl',
    mnemonic: 'Mnemonic',
    pitfall: 'Pitfall',
    formula: 'Formula',
    example: 'Worked example',
    check: 'Check yourself',
};

const CALLOUT_ALIASES = {
    important: 'highyield', key: 'highyield', tip: 'pearl', clinical: 'pearl', insight: 'pearl',
    warning: 'pitfall', caution: 'pitfall', danger: 'pitfall', quiz: 'check', recall: 'check',
    info: 'note', overview: 'note', summary: 'note', glance: 'note',
};

const MARKER = /^\s*\[!([A-Za-z-]+)\][ \t]*/;

/**
 * Turn `> [!TYPE] Title` blockquotes into callout boxes. The title runs to the end of the
 * marker's line; a blockquote without a marker stays a plain note.
 */
const buildCallout = (blockquote) => {
    const children = blockquote.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
    const first = children[0];
    const lead = isElement(first, 'p') ? first.children[0] : null;
    const marker = lead?.type === 'text' ? lead.value.match(MARKER) : null;

    if (!marker) {
        blockquote.tagName = 'div';
        blockquote.properties = { className: ['callout', 'callout-note', 'callout-plain'] };
        return;
    }

    const raw = marker[1].toLowerCase().replace(/-/g, '');
    const type = CALLOUT_LABELS[raw] ? raw : (CALLOUT_ALIASES[raw] || 'note');
    lead.value = lead.value.slice(marker[0].length);

    // Everything in the first paragraph up to its first line break is the title.
    const titleNodes = [];
    const rest = [];
    let inTitle = true;
    for (const node of first.children) {
        if (!inTitle) { rest.push(node); continue; }
        if (node.type === 'text' && node.value.includes('\n')) {
            const cut = node.value.indexOf('\n');
            const before = node.value.slice(0, cut);
            const after = node.value.slice(cut + 1);
            if (before) titleNodes.push({ type: 'text', value: before });
            if (after) rest.push({ type: 'text', value: after });
            inTitle = false;
        } else if (isElement(node, 'br')) {
            inTitle = false;
        } else {
            titleNodes.push(node);
        }
    }

    const hasTitle = titleNodes.some((n) => textOf(n).trim());
    const head = el('div', 'callout-title', [
        el('span', 'callout-label', [{ type: 'text', value: CALLOUT_LABELS[type] }]),
        ...(hasTitle ? [el('span', 'callout-heading', titleNodes)] : []),
    ]);

    const body = children.slice(1);
    if (rest.some((n) => textOf(n).trim() || n.type === 'element')) {
        body.unshift({ ...first, children: rest });
    }

    blockquote.tagName = 'div';
    blockquote.properties = { className: ['callout', `callout-${type}`] };
    blockquote.children = [head, ...body];
    if (type === 'check') hideCheckAnswers(blockquote);
};

const ARROW = /\s*(?:→|->|⇒)\s*/;

/**
 * In a CHECK callout, wrap everything after "→" in each item so it can be revealed on tap.
 */
const hideCheckAnswers = (callout) => {
    walk(callout, (node) => {
        if (!isElement(node, 'li')) return;
        const host = node.children.find((c) => isElement(c, 'p')) || node;
        const index = host.children.findIndex((c) => c.type === 'text' && ARROW.test(c.value));
        if (index === -1) return;
        const [question, ...answerParts] = host.children[index].value.split(ARROW);
        const answer = [];
        if (answerParts.join(' → ').trim()) answer.push({ type: 'text', value: answerParts.join(' → ') });
        answer.push(...host.children.slice(index + 1));
        host.children = [
            ...host.children.slice(0, index),
            { type: 'text', value: question },
            el('span', 'check-arrow', [{ type: 'text', value: ' → ' }], { ariaHidden: 'true' }),
            el('span', 'check-answer', answer, { tabIndex: 0, title: 'Tap to reveal' }),
        ];
    });
};

/**
 * Wrap tables so they scroll on narrow screens; tables with 4+ columns span both columns.
 */
const wrapTable = (table, parent) => {
    const firstRow = (() => {
        let row = null;
        walk(table, (n) => { if (!row && isElement(n, 'tr')) row = n; });
        return row;
    })();
    const columns = firstRow ? firstRow.children.filter((c) => isElement(c, 'th') || isElement(c, 'td')).length : 0;
    const wrapper = el('div', ['rv-table', ...(columns >= 4 ? ['rv-table-wide'] : [])], [table], { dataCols: String(columns) });
    parent.children[parent.children.indexOf(table)] = wrapper;
};

const HEADING_NUMBER = /^\s*(?:(?:\d+(?:\.\d+)*|[IVXLC]+|[A-Z])[.)]|\d+(?:\.\d+)+)\s+/;

const stripHeadingNumber = (heading) => {
    const lead = heading.children[0];
    if (lead?.type === 'text') lead.value = lead.value.replace(HEADING_NUMBER, '');
};

const slugify = (text, used) => {
    const base = text.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'section';
    let slug = `rv-${base}`;
    for (let n = 2; used.has(slug); n++) slug = `rv-${base}-${n}`;
    used.add(slug);
    return slug;
};

/**
 * rehype plugin: callouts, check answers, wrapped tables, and the document outline:
 *   <header class="rv-front">  title, meta line, opening notes, contents
 *   <section class="rv-section"><h2/><div class="rv-body">…</div></section>  per topic
 */
export function rehypeReviewer() {
    return (tree) => {
        const blockquotes = [];
        const tables = [];
        walk(tree, (node, parent) => {
            if (isElement(node, 'blockquote')) blockquotes.push(node);
            if (isElement(node, 'table') && parent) tables.push([node, parent]);
            if (isElement(node, 'h3')) stripHeadingNumber(node);
        });
        // Innermost first, so a quote inside a quote is handled before its parent reads it.
        blockquotes.reverse().forEach(buildCallout);
        tables.forEach(([table, parent]) => wrapTable(table, parent));

        const nodes = tree.children.filter((n) => !(n.type === 'text' && !n.value.trim()));
        const front = [];
        const sections = [];
        const used = new Set();
        for (const node of nodes) {
            if (isElement(node, 'h2')) {
                stripHeadingNumber(node);
                node.properties = { ...node.properties, id: slugify(textOf(node), used) };
                sections.push({ heading: node, body: [] });
            } else if (sections.length) {
                sections[sections.length - 1].body.push(node);
            } else {
                if (isElement(node, 'h4') || isElement(node, 'h5')) node.properties = { className: ['rv-meta'] };
                front.push(node);
            }
        }

        if (sections.length >= 3) {
            front.push(el('nav', 'rv-toc', [
                el('div', 'rv-toc-title', [{ type: 'text', value: 'Contents' }]),
                el('ol', null, sections.map(({ heading }) =>
                    el('li', null, [el('a', null, [{ type: 'text', value: textOf(heading) }], { href: `#${heading.properties.id}` })]))),
            ], { ariaLabel: 'Contents' }));
        }

        tree.children = [
            ...(front.length ? [el('header', 'rv-front', front)] : []),
            ...sections.map(({ heading, body }) =>
                el('section', 'rv-section', [heading, el('div', 'rv-body', body)], { ariaLabelledBy: heading.properties.id })),
        ];
        // A reviewer with no ## headings at all still gets the body layout.
        if (!sections.length && front.length) {
            const [header] = tree.children;
            const title = header.children.filter((n) => isElement(n, 'h1') || hasClass(n, 'rv-meta'));
            const rest = header.children.filter((n) => !title.includes(n));
            tree.children = [el('header', 'rv-front', title), el('section', 'rv-section', [el('div', 'rv-body', rest)])];
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout pass (runs on the rendered DOM)
// ─────────────────────────────────────────────────────────────────────────────

// Widths in em at the reviewer's print size: an A4 page with 13 mm margins holds about 48em of
// 10pt text, one of two columns about 23em. Display math wider than its column spans the page,
// and anything wider than the page is scaled down, so formulas never run into the next column.
const PAGE_EM = 48;
const COLUMN_EM = 23;

/**
 * Measure display formulas and mark the ones that would overflow their column or the page.
 */
export const fitWideMath = (root, columns) => {
    if (!root) return;
    // rehype-katex renders display math as a block-level span.katex-display.
    for (const block of root.querySelectorAll('.katex-display')) {
        const katex = block.querySelector('.katex-html');
        if (!katex) continue;
        let width = 0;
        for (const base of katex.children) width += base.getBoundingClientRect().width;
        const em = width / (parseFloat(getComputedStyle(katex).fontSize) || 16);
        const inBody = block.parentElement?.classList.contains('rv-body');
        const spans = columns === 2 && inBody && em > COLUMN_EM;
        const limit = columns === 2 && !spans ? COLUMN_EM : PAGE_EM;

        block.classList.toggle('math-wide', spans);
        if (em > limit) {
            block.classList.add('math-fit');
            block.style.setProperty('--math-fit', (limit / em).toFixed(3));
        } else {
            block.classList.remove('math-fit');
            block.style.removeProperty('--math-fit');
        }
    }
};

/**
 * The title of a reviewer, for library names and the PDF file name.
 */
export const reviewerTitle = (markdown, fallback = 'Reviewer') => {
    const match = String(markdown || '').match(/^#\s+(.+)$/m);
    return match ? match[1].replace(/[*_=`$]/g, '').trim().slice(0, 120) || fallback : fallback;
};

/**
 * Pick black or white text for a heading bar in the given colour.
 */
export const contrastText = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.4 ? '#1E1C19' : '#FFFDF7';
};
