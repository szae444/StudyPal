/**
 * StudyPal Client-side File Parsing Utilities
 * PDF.js is loaded on demand, so it only downloads when someone opens a PDF.
 */

// The legacy build supports older phones (no Promise.withResolvers on iOS < 17.4).
const loadPdfJs = async () => {
    const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.min.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
};

// Pages with less text than this on average have no real text layer (scanned or photographed).
const SCANNED_CHARS_PER_PAGE = 60;

/**
 * Read a PDF's text, keeping its line breaks so headings, bullets and tables stay recognisable.
 * Returns { text, pages, scanned }.
 */
export const readPDF = async (arrayBuffer) => {
    const pdfjs = await loadPdfJs();
    try {
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), verbosity: 0 }).promise;
        let fullText = '';
        let contentChars = 0;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            let pageText = '';
            for (const item of textContent.items) {
                pageText += item.str;
                if (item.hasEOL) pageText += '\n';
            }
            pageText = pageText.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
            contentChars += pageText.replace(/\s/g, '').length;
            fullText += `\n--- Page ${pageNum} ---\n${pageText}`;
            page.cleanup();
        }

        return {
            text: fullText.trim(),
            pages: pdf.numPages,
            scanned: contentChars / Math.max(pdf.numPages, 1) < SCANNED_CHARS_PER_PAGE,
        };
    } catch (error) {
        console.error("PDF.js extraction failed:", error);
        throw new Error("Failed to read this PDF. It may be password-protected or damaged.");
    }
};

/**
 * Extract a PDF's text (used by the AI assistant).
 */
export const extractTextFromPDF = async (arrayBuffer) => (await readPDF(arrayBuffer)).text;
