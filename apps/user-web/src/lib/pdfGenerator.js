/**
 * Client-side PDF ticket for Rupadiya Bus Samiti (A4 portrait, no external PDF library).
 * Same simple layout as the printed ticket: header, journey, bus, boarding/dropping,
 * contact, passenger list, fare details, payment, guidelines and the boarding QR code.
 * Long passenger lists continue on extra pages. Saves as Ticket-<PNR>.pdf.
 */
import QRCode from 'qrcode';

const PAGE_W = 595;
const PAGE_H = 842;
const LEFT = 40;
const RIGHT = 555;
const WIDTH = RIGHT - LEFT;
const BOTTOM = 50;

const BLUE = [0.08, 0.58, 0.94];
const INK = [0.08, 0.12, 0.2];
const MUTED = [0.38, 0.43, 0.5];
const LINE = [0.84, 0.87, 0.91];
const GREEN = [0.05, 0.55, 0.33];
const RED = [0.8, 0.15, 0.2];

const money = (v) => `Rs. ${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
const has = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '—';

// Standard Helvetica / Helvetica-Bold glyph widths (1/1000 em) for ASCII 32..126,
// so right-aligned amounts line up and long text is cut before it leaves its box.
const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const textWidth = (s, size, bold) => {
  const table = bold ? W_BOLD : W_REG;
  let w = 0;
  for (const ch of plainText(s)) w += table[ch.charCodeAt(0) - 32] || 556;
  return (w * size) / 1000;
};
const fit = (s, maxW, size, bold) => {
  let t = String(s ?? '');
  if (textWidth(t, size, bold) <= maxW) return t;
  while (t.length > 1 && textWidth(`${t}...`, size, bold) > maxW) t = t.slice(0, -1);
  return `${t}...`;
};

// Built-in PDF fonts only cover plain Latin text: map the few symbols we use, drop the rest.
function plainText(text) {
  return String(text ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/[–—]/g, '-')
    .replace(/[·•]/g, '|')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function cleanText(text) {
  return plainText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/** Fare lines from a booking's fareBreakdown (only the lines that apply). */
export function fareLinesFrom(fb = {}, { insuranceAmount, discountAmount } = {}) {
  const seats = Number(fb.seatCount) || 0;
  const base = Number(fb.baseFare) || 0;
  const lines = [
    [seats && base ? `Base fare (${seats} x Rs. ${base.toLocaleString('en-IN')})` : 'Base fare', fb.subtotal],
    ['GST (5%)', fb.gstAmount],
    ['Platform fee', fb.platformFee],
    [fb.gatewayFeeActual != null ? 'Payment gateway charge (actual)' : 'Payment gateway charge', fb.gatewayFeeActual ?? fb.gatewayFee],
    [`Travel insurance${fb.insurancePerPassenger ? ` (Rs. ${fb.insurancePerPassenger}/passenger)` : ''}`, insuranceAmount ?? fb.insuranceAmount],
    ['Discount', -(Number(discountAmount ?? fb.discountAmount) || 0)]
  ];
  return lines.filter(([, v]) => Number(v));
}

export function downloadTicketPdf(input = {}) {
  const pnr = input.pnr || input.bookingId || '';
  const cancelled = String(input.status || '').toUpperCase() === 'CANCELLED';
  const statusLabel = cancelled ? 'CANCELLED - NOT VALID FOR TRAVEL' : String(input.status || 'CONFIRMED').toUpperCase();

  let fromCity = input.fromCity || input.sourceCity || '';
  if (fromCity.toLowerCase() === 'rupadiya') fromCity = 'Rupaidiha';
  const toCity = input.toCity || input.destinationCity || '';
  const dateStr = input.dateStr || input.travelDate || input.departureDate || '';
  const timeStr = input.timeStr || input.departureTime || '';
  const arrTimeStr = input.arrTimeStr || input.arrivalTime || '';

  const busName = input.busName || input.operatorName || '';
  const companyName = input.companyName && input.companyName !== busName ? input.companyName : '';
  const busNumber = input.busNumber || input.registrationNumber || '';
  const busModel = input.busModel || input.busType || '';
  const amenities = Array.isArray(input.amenities) ? input.amenities.filter(Boolean).join(', ') : (input.amenities || '');

  const passengers = (input.passengers && input.passengers.length)
    ? input.passengers
    : [{ name: input.travelerName || 'Passenger', seatNumber: input.seatsStr }];
  const seatsStr = input.seatsStr || passengers.map((p) => p.seatNumber).filter(Boolean).join(', ');

  const contactName = input.travelerName || input.contactName || passengers[0]?.name || '';
  const contactPhone = input.travelerPhone || input.contactPhone || '';
  const contactEmail = input.travelerEmail || input.contactEmail || '';

  const fb = input.fareBreakdown || {};
  const fareLines = input.fareLines || (Object.keys(fb).length ? fareLinesFrom(fb, input) : [
    ['Base fare', input.baseFare],
    ['GST (5%)', input.gstAmount ?? input.gst],
    ['Travel insurance', input.insuranceAmount]
  ].filter(([, v]) => Number(String(v ?? '').replace(/,/g, ''))));
  const total = input.totalFare ?? input.totalPaid ?? input.totalAmount ?? fb.totalPayable ?? 0;
  const totalNum = Number(String(total).replace(/,/g, '')) || 0;

  // ---- drawing helpers (multi-page) --------------------------------------
  const pages = [];
  let ops = null;
  let y = 0;
  const text = (s, x, yy, size = 9, bold = false, c = INK) => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${c[0]} ${c[1]} ${c[2]} rg 1 0 0 1 ${x.toFixed(1)} ${yy.toFixed(1)} Tm (${cleanText(s)}) Tj ET`);
  };
  const textRight = (s, xr, yy, size = 9, bold = false, c = INK) => text(s, xr - textWidth(s, size, bold), yy, size, bold, c);
  const rect = (x, yy, w, h, c, fill = true) => {
    ops.push(`q ${c[0]} ${c[1]} ${c[2]} ${fill ? 'rg' : 'RG'} 0.8 w ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re ${fill ? 'f' : 'S'} Q`);
  };
  const hline = (yy, c = LINE) => ops.push(`q ${c[0]} ${c[1]} ${c[2]} RG 0.8 w ${LEFT} ${yy} m ${RIGHT} ${yy} l S Q`);
  const label = (s, x, yy) => text(String(s).toUpperCase(), x, yy, 7, true, MUTED);

  const newPage = (continued) => {
    ops = [];
    pages.push(ops);
    rect(28, 28, PAGE_W - 56, PAGE_H - 56, LINE, false);
    if (continued) {
      text(`Rupadiya Bus Samiti | Ticket PNR ${pnr} (continued)`, LEFT, PAGE_H - 60, 10, true, BLUE);
      hline(PAGE_H - 68);
      y = PAGE_H - 90;
    }
  };
  const ensure = (h) => { if (y - h < BOTTOM) newPage(true); };

  // ---- 1. header banner ----------------------------------------------------
  newPage(false);
  rect(28, PAGE_H - 108, PAGE_W - 56, 80, BLUE);
  rect(LEFT, PAGE_H - 92, 48, 48, [1, 1, 1]);
  text('RUP', LEFT + 9, PAGE_H - 73, 14, true, BLUE);
  text('RUPADIYA BUS SAMITI', LEFT + 60, PAGE_H - 62, 17, true, [1, 1, 1]);
  text('PASSENGER E-TICKET', LEFT + 60, PAGE_H - 78, 9, false, [0.9, 0.95, 1]);
  if (companyName || busName) text(fit(`Operator: ${companyName || busName}`, 250, 8, false), LEFT + 60, PAGE_H - 92, 8, false, [0.9, 0.95, 1]);
  textRight(`PNR: ${pnr}`, RIGHT, PAGE_H - 60, 13, true, [1, 1, 1]);
  textRight(`STATUS: ${statusLabel}`, RIGHT, PAGE_H - 76, 9, true, cancelled ? [1, 0.8, 0.8] : [0.8, 1, 0.85]);
  if (input.bookedAt) textRight(`Booked: ${input.bookedAt}`, RIGHT, PAGE_H - 92, 8, false, [0.9, 0.95, 1]);

  // ---- 2. journey + QR -----------------------------------------------------
  const qrSize = 104;
  const showQr = Boolean(input.qrToken) && !cancelled;
  const jTop = PAGE_H - 124;
  const jW = showQr ? WIDTH - qrSize - 12 : WIDTH;
  const jH = qrSize;
  rect(LEFT, jTop - jH, jW, jH, [0.96, 0.98, 1]);
  rect(LEFT, jTop - jH, jW, jH, [0.8, 0.88, 0.96], false);
  const half = jW / 2;
  label('From', LEFT + 12, jTop - 18);
  text(fit(fromCity.toUpperCase() || '-', half - 24, 14, true), LEFT + 12, jTop - 36, 14, true);
  text(fit(`Departure: ${timeStr || '-'}`, half - 24, 9, true), LEFT + 12, jTop - 52, 9, true, BLUE);
  label('To', LEFT + half + 6, jTop - 18);
  text(fit(toCity.toUpperCase() || '-', half - 18, 14, true), LEFT + half + 6, jTop - 36, 14, true);
  text(fit(`Arrival: ${arrTimeStr || '-'}`, half - 18, 9, false), LEFT + half + 6, jTop - 52, 9, false, MUTED);
  ops.push(`q ${LINE[0]} ${LINE[1]} ${LINE[2]} RG 0.8 w ${LEFT + 12} ${jTop - 64} m ${LEFT + jW - 12} ${jTop - 64} l S Q`);
  label('Date of journey', LEFT + 12, jTop - 78);
  text(fit(dateStr || '-', half - 24, 10, true), LEFT + 12, jTop - 92, 10, true);
  label('Seat(s)', LEFT + half + 6, jTop - 78);
  text(fit(seatsStr || '-', half - 18, 10, true), LEFT + half + 6, jTop - 92, 10, true, BLUE);

  if (showQr) {
    const qx = RIGHT - qrSize;
    const qy = jTop - qrSize;
    rect(qx, qy, qrSize, qrSize, [1, 1, 1]);
    rect(qx, qy, qrSize, qrSize, LINE, false);
    try {
      const qr = QRCode.create(String(input.qrToken), { errorCorrectionLevel: 'M' });
      const n = qr.modules.size;
      const cell = (qrSize - 12) / n;
      const ox = qx + 6;
      const oy = qy + 6;
      for (let r = 0; r < n; r += 1) {
        for (let c = 0; c < n; c += 1) {
          if (qr.modules.get(r, c)) ops.push(`${(ox + c * cell).toFixed(2)} ${(oy + (n - 1 - r) * cell).toFixed(2)} ${(cell + 0.05).toFixed(2)} ${(cell + 0.05).toFixed(2)} re`);
        }
      }
      ops.push('0 0 0 rg f');
    } catch (e) { /* QR is optional; the PNR still works for boarding */ }
    text('Show this QR while boarding', qx + 2, qy - 10, 7, false, MUTED);
  }
  y = jTop - jH - 16;

  // ---- 3. bus details ------------------------------------------------------
  const busRows = [
    ['Bus', busName], ['Bus number', busNumber], ['Coach type', busModel],
    ['Operator', companyName],
    ['Driver', [input.driverName, input.driverPhone].filter(has).join(' | ')],
    ['Bus manager', [input.managerName, input.managerPhone].filter(has).join(' | ')]
  ].filter(([, v]) => has(v));
  if (busRows.length || amenities) {
    const rowsN = Math.ceil(busRows.length / 2);
    const h = 22 + rowsN * 26 + (amenities ? 16 : 0);
    ensure(h + 10);
    rect(LEFT, y - h, WIDTH, h, [0.97, 0.98, 0.99]);
    rect(LEFT, y - h, WIDTH, h, LINE, false);
    text('BUS DETAILS', LEFT + 12, y - 14, 8, true, BLUE);
    busRows.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = LEFT + 12 + col * (WIDTH / 2);
      const yy = y - 30 - row * 26;
      label(k, x, yy);
      text(fit(v, WIDTH / 2 - 24, 9.5, true), x, yy - 11, 9.5, true);
    });
    if (amenities) text(fit(`Amenities: ${amenities}`, WIDTH - 24, 8, false), LEFT + 12, y - h + 8, 8, false, MUTED);
    y -= h + 10;
  }

  // ---- 4. boarding / dropping ---------------------------------------------
  ensure(70);
  const bw = (WIDTH - 10) / 2;
  [[LEFT, 'Boarding point', input.boardingName || input.boardingPoint?.name, input.boardingTime || timeStr, 'Please report 15 minutes before departure'],
    [LEFT + bw + 10, 'Dropping point', input.droppingName || input.droppingPoint?.name, input.droppingTime || arrTimeStr, '']]
    .forEach(([x, k, name, t, note]) => {
      rect(x, y - 58, bw, 58, LINE, false);
      label(k, x + 10, y - 14);
      text(fit(name || '-', bw - 20, 10, true), x + 10, y - 28, 10, true);
      if (has(t)) text(fit(`Time: ${t}`, bw - 20, 8.5, false), x + 10, y - 41, 8.5, false, BLUE);
      if (note) text(fit(note, bw - 20, 7.5, false), x + 10, y - 52, 7.5, false, [0.7, 0.45, 0.05]);
    });
  y -= 72;

  // ---- 5. contact ----------------------------------------------------------
  const contactBits = [contactName, contactPhone && `Phone: ${contactPhone}`, contactEmail && `Email: ${contactEmail}`].filter(Boolean);
  const ec = input.emergencyContact;
  if (contactBits.length || ec?.phone) {
    ensure(34);
    if (contactBits.length) { label('Contact', LEFT, y); text(fit(contactBits.join('  |  '), WIDTH - 80, 9, false), LEFT + 80, y, 9, false); y -= 14; }
    if (ec?.phone) { label('Emergency', LEFT, y); text(fit(`${ec.name || ''}${ec.relation ? ` (${ec.relation})` : ''}  |  ${ec.phone}`, WIDTH - 80, 9, false), LEFT + 80, y, 9, false); y -= 14; }
    y -= 6;
  }

  // ---- 6. passenger table --------------------------------------------------
  const cols = [LEFT + 8, LEFT + 30, LEFT + 260, LEFT + 360, LEFT + 440];
  const tableHeader = () => {
    rect(LEFT, y - 16, WIDTH, 16, [0.93, 0.95, 0.96]);
    ['#', 'PASSENGER NAME', 'AGE / GENDER', 'SEAT', 'STATUS'].forEach((h, i) => text(h, cols[i], y - 11, 7.5, true, MUTED));
    y -= 30;
  };
  ensure(60);
  text(`PASSENGERS (${passengers.length})`, LEFT, y, 9, true);
  y -= 8;
  tableHeader();
  passengers.forEach((p, i) => {
    const infants = Array.isArray(p.infants) ? p.infants : [];
    if (y - 6 - infants.length * 12 < BOTTOM) { newPage(true); tableHeader(); }
    const gender = has(p.gender) ? String(p.gender).toUpperCase() : '-';
    text(String(i + 1), cols[0], y, 8.5, false, MUTED);
    text(fit(`${p.name || `Passenger ${i + 1}`}${p.isChild ? ' (child)' : ''}`, 220, 9.5, true), cols[1], y, 9.5, true);
    text(`${has(p.age) ? `${p.age} yrs` : '-'} / ${gender}`, cols[2], y, 8.5, false);
    text(fit(String(p.seatNumber || '-'), 74, 9.5, true), cols[3], y, 9.5, true, BLUE);
    text(cancelled ? 'Cancelled' : 'Confirmed', cols[4], y, 8.5, true, cancelled ? RED : GREEN);
    y -= 12;
    infants.forEach((inf) => {
      text(fit(`+ Infant on lap: ${inf.name || ''} (${inf.age ?? '-'} yr${inf.gender ? `, ${inf.gender}` : ''})`, 300, 7.5, false), cols[1], y, 7.5, false, MUTED);
      y -= 11;
    });
    ops.push(`q ${LINE[0]} ${LINE[1]} ${LINE[2]} RG 0.5 w ${LEFT} ${y + 5} m ${RIGHT} ${y + 5} l S Q`);
    y -= 6;
  });
  y -= 4;

  // ---- 7. fare details + payment ------------------------------------------
  const extraLines = [];
  if (Number(input.agentServiceCharge) > 0) extraLines.push(['Agent service charge', input.agentServiceCharge]);
  const fh = 28 + (fareLines.length + extraLines.length) * 13 + 16;
  ensure(fh + 10);
  rect(LEFT, y - fh, WIDTH, fh, [0.98, 0.99, 0.98]);
  rect(LEFT, y - fh, WIDTH, fh, LINE, false);
  const fx = LEFT + WIDTH / 2 + 10;
  const fr = RIGHT - 12;
  text('FARE DETAILS', fx, y - 14, 8, true, BLUE);
  let fy = y - 30;
  fareLines.forEach(([k, v]) => {
    const n = Number(String(v).replace(/,/g, '')) || 0;
    text(fit(k, fr - fx - 70, 8.5, false), fx, fy, 8.5, false, MUTED);
    textRight(`${n < 0 ? '- ' : ''}${money(Math.abs(n))}`, fr, fy, 8.5, true, n < 0 ? GREEN : INK);
    fy -= 13;
  });
  ops.push(`q ${LINE[0]} ${LINE[1]} ${LINE[2]} RG 0.8 w ${fx} ${fy + 8} m ${fr} ${fy + 8} l S Q`);
  fy -= 4;
  text(input.totalLabel || (cancelled ? 'Amount paid' : 'Total amount paid'), fx, fy, 10, true);
  textRight(money(totalNum), fr, fy, 12, true, BLUE);
  extraLines.forEach(([k, v]) => { fy -= 14; text(k, fx, fy, 8.5, false, MUTED); textRight(money(v), fr, fy, 8.5, true); });

  // payment column (left)
  const px = LEFT + 12;
  const pw = WIDTH / 2 - 24;
  text('PAYMENT', px, y - 14, 8, true, BLUE);
  let py = y - 30;
  [
    ['Paid via', input.paymentProvider],
    ['Reference', input.paymentReference],
    ['Status', input.paymentStatus],
    ['Note', input.paymentNote],
    ['Issued by', input.issuedBy || (input.agencyName ? `${input.agencyName}${input.agentCode ? ` (${input.agentCode})` : ''}` : '')]
  ].filter(([, v]) => has(v)).forEach(([k, v]) => {
    label(k, px, py);
    text(fit(v, pw - 62, 8.5, true), px + 62, py, 8.5, true);
    py -= 13;
  });
  if (cancelled && input.cancellationNote) { text(fit(input.cancellationNote, pw, 8.5, true), px, py, 8.5, true, RED); }
  y -= fh + 14;

  // ---- 8. guidelines -------------------------------------------------------
  const rules = [
    'Reporting: reach the boarding point at least 15 minutes before departure.',
    'ID proof: carry a valid government photo ID (Aadhaar / Voter ID / Driving Licence / Passport).',
    'Boarding: show the QR code or tell the PNR to the bus manager.',
    'Luggage: up to 2 pieces (20 kg) per passenger. Inflammable items are not allowed.',
    'Cancellation refund: more than 48 h before departure 90% | 24-48 h 75% | 12-24 h 50% | under 12 h none.'
  ];
  ensure(14 + rules.length * 11);
  text('IMPORTANT INFORMATION', LEFT, y, 8.5, true);
  y -= 13;
  rules.forEach((r, i) => { text(fit(`${i + 1}. ${r}`, WIDTH, 7.8, false), LEFT + 6, y, 7.8, false, MUTED); y -= 11; });

  // ---- footer on every page -----------------------------------------------
  pages.forEach((p, i) => {
    ops = p;
    text('Rupadiya Bus Samiti | Have a safe and happy journey!', LEFT, 38, 7.5, false, MUTED);
    textRight(`PNR ${pnr} | Page ${i + 1} of ${pages.length}`, RIGHT, 38, 7.5, false, MUTED);
  });

  // ---- assemble PDF ----------------------------------------------------------
  const enc = new TextEncoder();
  const pageCount = pages.length;
  const fontF1 = 3 + pageCount * 2;
  const fontF2 = fontF1 + 1;
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
  pages.forEach((p, i) => {
    const stream = p.join('\n');
    objs[3 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${fontF1} 0 R /F2 ${fontF2} 0 R >> >> >>`;
    objs[4 + i * 2] = `<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });
  objs[fontF1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[fontF2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  let body = '%PDF-1.4\n';
  const offsets = [];
  for (let id = 1; id < objs.length; id += 1) {
    offsets[id] = enc.encode(body).length;
    body += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const startXref = enc.encode(body).length;
  let xref = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id += 1) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  const pdf = `${body}${xref}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const blob = new Blob([enc.encode(pdf)], { type: 'application/pdf' });
  const filename = input.filename || `Ticket-${String(pnr).replace(/[^A-Za-z0-9_-]/g, '') || 'booking'}.pdf`;
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 250);
  }
  return { blob, filename };
}
