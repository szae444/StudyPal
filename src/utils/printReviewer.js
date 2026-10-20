/**
 * Print a rendered reviewer (or save it as PDF) in a new tab.
 *
 * The tab gets the app's own stylesheets, so the PDF uses the same fonts, KaTeX version and
 * layout rules as the screen; the print rules in index.css then switch it to A4 pages.
 */

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const printReviewer = (article, title = 'Reviewer') => {
    if (!article) return false;
    const win = window.open('', '_blank');
    if (!win) return false;

    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
        .map((node) => node.outerHTML)
        .join('\n');

    win.document.open();
    win.document.write(`<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${escapeHtml(window.location.origin)}/">
<title>${escapeHtml(title)}</title>
${styles}
</head>
<body class="rv-print-body">
${article.outerHTML}
<script>
  // Wait for stylesheets and fonts, or the PDF can come out in fallback fonts.
  window.addEventListener('load', function () {
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () { setTimeout(function () { window.focus(); window.print(); }, 150); });
  });
</script>
</body>
</html>`);
    win.document.close();
    return true;
};
