import html2canvas from 'html2canvas';

/** A4 content width used by print sheets (~190mm at 96dpi) */
const SLIP_WIDTH_PX = 718;

/**
 * Capture a print slip as a PNG data URL.
 * Clones into an on-page host so html2canvas does not glitch text/lines
 * the way it does with off-screen + letter-spacing / underline fields.
 */
export async function captureSlipImage(selector) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) {
    throw new Error('Slip not found on page');
  }

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const host = document.createElement('div');
  host.className = 'slip-capture-host';

  const clone = el.cloneNode(true);
  clone.classList.add('slip-capture-target');
  clone.setAttribute('aria-hidden', 'true');
  host.appendChild(clone);
  document.body.appendChild(host);

  // Let layout settle in the capture host
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: SLIP_WIDTH_PX,
      windowWidth: SLIP_WIDTH_PX,
      onclone: (_doc, clonedEl) => {
        clonedEl.style.width = `${SLIP_WIDTH_PX}px`;
        clonedEl.style.maxWidth = `${SLIP_WIDTH_PX}px`;
        clonedEl.style.boxSizing = 'border-box';

        clonedEl.querySelectorAll('*').forEach((node) => {
          node.style.letterSpacing = '0';
          node.style.wordSpacing = 'normal';
          node.style.textRendering = 'geometricPrecision';
        });

        // Keep underline fields from colliding with text in the raster
        clonedEl
          .querySelectorAll(
            '.pb-value, .pb-words-text, .ap-row > b, .ap-meta b, .ap-amount-words b'
          )
          .forEach((node) => {
            node.style.paddingBottom = '4px';
            node.style.lineHeight = '1.5';
            node.style.minHeight = '22px';
            node.style.display = 'block';
            node.style.flex = '1';
          });

        clonedEl.querySelectorAll('.pb-field, .ap-row, .ap-amount-words, .pb-words').forEach(
          (node) => {
            node.style.alignItems = 'flex-end';
            node.style.marginBottom = '6px';
          }
        );

        clonedEl.querySelectorAll('.pb-table th, .pb-table td').forEach((node) => {
          node.style.padding = '6px 8px';
          node.style.lineHeight = '1.4';
          node.style.verticalAlign = 'middle';
        });

        clonedEl.querySelectorAll('.pb-hospital, .ap-hospital, .pb-reg').forEach((node) => {
          node.style.lineHeight = '1.25';
          node.style.letterSpacing = '0';
        });
      },
    });

    return canvas.toDataURL('image/png');
  } finally {
    host.remove();
  }
}

export const SLIP_SELECTORS = {
  advance: '.advance-print',
  simple: '.bill-print.bill-simple',
  detailed: '.bill-print.bill-detailed',
  payment: '.payment-print',
};
