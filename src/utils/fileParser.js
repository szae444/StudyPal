/**
 * StudyPal Client-side File Parsing Utilities
 * Provides dynamic loading for PDF.js and Tesseract.js to securely parse PDFs and OCR images.
 */

/**
 * Dynamically loads and extracts text from a PDF file using PDF.js
 */
export const extractTextFromPDF = async (arrayBuffer) => {
    if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Configure worker source location
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    try {
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `\n--- Page ${pageNum} ---\n${pageText}`;
        }

        return fullText.trim();
    } catch (error) {
        console.error("PDF.js extraction failed:", error);
        throw new Error("Failed to parse PDF content. Please check if the document contains scanned pages or copy protection.");
    }
};

/**
 * Dynamically loads and performs OCR on an image file using Tesseract.js
 */
export const extractTextFromImage = async (file) => {
    if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/tesseract.js@v4.0.1/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    try {
        const worker = await window.Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();
        return text.trim();
    } catch (error) {
        console.error("Tesseract.js OCR failed:", error);
        throw new Error("Failed to perform OCR text extraction on this image.");
    }
};
