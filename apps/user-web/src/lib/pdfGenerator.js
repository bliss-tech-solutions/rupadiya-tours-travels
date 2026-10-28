/**
 * Client-Side PDF Generator for Rupadiya Travel Boarding Pass
 * Creates a valid, standard PDF 1.4 document directly in the browser
 * with 0 external dependencies, saving as Ticket-[BookingId].pdf.
 */

export function downloadTicketPdf({
  bookingId = 'RUP-7829-BK',
  travelerName = 'Traveler',
  busName = 'Rupadiya Intercity Express',
  busModel = 'Setra Coach Bus (2+2 AC Seater)',
  dateStr = 'Mon, 27th Oct',
  timeStr = '05:30 PM',
  seatsStr = '1, 2',
  boardingName = 'Rupadiya Border Main Stand',
  droppingName = 'Ahmedabad Central Bus Station',
  totalFare = '1,700',
  passengers = [],
  cashbackCode = 'NEXTTRIP150'
}) {
  const content = [];

  // Helper to add sanitized text
  const addText = (text, x, y, size = 11, isBold = false, r = 0.1, g = 0.12, b = 0.15) => {
    const clean = String(text || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    content.push(`BT /${isBold ? 'F2' : 'F1'} ${size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${x} ${y} Tm (${clean}) Tj ET`);
  };

  // Helper to add rectangles
  const addRect = (x, y, w, h, r, g, b, fill = true) => {
    content.push(`q ${r} ${g} ${b} ${fill ? 'rg' : 'RG'} ${x} ${y} ${w} ${h} re ${fill ? 'f' : 's'} Q`);
  };

  // 1. Top Brand Banner (Rupadiya Travel Sky Blue)
  addRect(36, 730, 523, 76, 0.08, 0.58, 0.94, true);
  
  // Brand Logo Accent Box
  addRect(52, 746, 44, 44, 1, 1, 1, true);
  addText('Rupadiya', 59, 762, 16, true, 0.08, 0.58, 0.94);

  // Brand Name & Pass Title
  addText('Rupadiya TRAVEL', 106, 772, 18, true, 1, 1, 1);
  addText('OFFICIAL INTERCITY BOARDING PASS', 106, 752, 10, false, 0.9, 0.95, 1);
  addText(`STATUS: CONFIRMED`, 390, 772, 10, true, 0.8, 1, 0.85);
  addText(`BOOKING ID: #${bookingId}`, 390, 752, 10, true, 1, 1, 1);

  // 2. Card Outer Border
  addRect(36, 110, 523, 620, 0.88, 0.91, 0.94, false);

  // 3. Traveler Greeting & Coach Details
  addText(`Dear ${travelerName},`, 56, 700, 14, true, 0.08, 0.12, 0.2);
  addText(`Your intercity bus reservation has been confirmed with Rupadiya Travel.`, 56, 684, 10, false, 0.4, 0.45, 0.5);

  addText(`Bus Operator: ${busName}`, 56, 664, 11, true, 0.1, 0.15, 0.22);
  addText(`Coach Type: ${busModel} · Direct Nonstop Service`, 56, 650, 9, false, 0.4, 0.45, 0.5);

  // Divider Line
  addRect(56, 638, 483, 1, 0.88, 0.91, 0.94, true);

  // 4. Highlighted Journey Info Box (2x2 Grid)
  addRect(56, 528, 483, 98, 0.96, 0.98, 1.0, true);
  addRect(56, 528, 483, 98, 0.82, 0.89, 0.96, false);

  // Box 1: Travel Date
  addText('TRAVEL DATE', 74, 604, 8, true, 0.35, 0.45, 0.55);
  addText(dateStr, 74, 586, 12, true, 0.08, 0.15, 0.25);

  // Box 2: Departure Time
  addText('DEPARTURE TIME', 200, 604, 8, true, 0.35, 0.45, 0.55);
  addText(timeStr, 200, 586, 12, true, 0.08, 0.58, 0.94);

  // Box 3: Confirmed Seats
  addText('ASSIGNED SEATS', 320, 604, 8, true, 0.35, 0.45, 0.55);
  addText(`Seats: ${seatsStr}`, 320, 586, 12, true, 0.05, 0.62, 0.38);

  // Box 4: Total Amount Paid
  addText('TOTAL FARE PAID', 430, 604, 8, true, 0.35, 0.45, 0.55);
  addText(`Rs. ${totalFare}`, 430, 586, 12, true, 0.1, 0.15, 0.2);

  // Boarding Point & Dropping Point
  addText('BOARDING POINT:', 74, 552, 8, true, 0.35, 0.45, 0.55);
  addText(boardingName, 170, 552, 9, true, 0.1, 0.15, 0.2);

  addText('DROPPING POINT:', 74, 538, 8, true, 0.35, 0.45, 0.55);
  addText(droppingName, 170, 538, 9, false, 0.25, 0.3, 0.35);

  // 5. Passenger List Section
  addText('PASSENGER DETAILS', 56, 502, 10, true, 0.15, 0.2, 0.3);
  addRect(56, 492, 483, 1, 0.88, 0.91, 0.94, true);

  let currentY = 474;
  if (passengers && passengers.length > 0) {
    passengers.forEach((p, idx) => {
      const pName = p.name || `Passenger ${idx + 1}`;
      const pAge = p.age ? `${p.age} yrs` : '';
      const pGender = p.gender ? `(${p.gender.toUpperCase()})` : '';
      const pSeat = p.seatNumber ? `Seat: ${p.seatNumber}` : '';
      addText(`${idx + 1}. ${pName}  ${pAge} ${pGender}  ${pSeat}`, 64, currentY, 9, false, 0.15, 0.2, 0.25);
      currentY -= 16;
    });
  } else {
    addText(`1. ${travelerName}  Seats: [${seatsStr}]  Status: Confirmed`, 64, currentY, 9, false, 0.15, 0.2, 0.25);
    currentY -= 16;
  }

  // 6. Cashback Coupon Box
  addRect(56, currentY - 50, 483, 44, 0.99, 0.96, 0.89, true);
  addRect(56, currentY - 50, 483, 44, 0.95, 0.85, 0.6, false);
  addText('NEXT TRIP CASHBACK OFFER', 72, currentY - 22, 9, true, 0.6, 0.4, 0.05);
  addText(`Flat Rs. 150 OFF applied on your next booking!  Use Promo Code: ${cashbackCode}`, 72, currentY - 38, 8, false, 0.4, 0.3, 0.1);

  currentY -= 65;

  // 7. Travel Guidelines
  addText('IMPORTANT TRAVEL GUIDELINES', 56, currentY, 9, true, 0.2, 0.25, 0.35);
  currentY -= 14;
  addText('- Please report at the boarding point 15 minutes prior to scheduled departure.', 64, currentY, 8, false, 0.4, 0.45, 0.5);
  currentY -= 12;
  addText('- Carry this boarding pass (printed or digital on your phone) and a valid Govt Photo ID.', 64, currentY, 8, false, 0.4, 0.45, 0.5);
  currentY -= 12;
  addText('- Bus departure schedules are strictly managed. 24/7 Helpline: +91 98765 43210.', 64, currentY, 8, false, 0.4, 0.45, 0.5);

  // 8. Realistic High-Contrast Barcode & Booking ID
  const barY = 135;
  const barHeights = 38;
  const pattern = [3, 1, 4, 1, 2, 5, 1, 2, 4, 2, 1, 3, 5, 2, 1, 4, 2, 3, 1, 5, 2, 1, 3, 4, 1, 2, 4, 3, 1, 5, 2, 4, 2, 1, 3, 4, 2, 1, 4, 2, 1, 3, 5];
  let curX = 145;
  for (let i = 0; i < pattern.length; i++) {
    const w = pattern[i];
    if (i % 2 === 0) {
      addRect(curX, barY, w * 1.5, barHeights, 0.1, 0.12, 0.15, true);
    }
    curX += (w * 1.5) + 2;
  }
  addText(`* ${bookingId} *`, 245, 120, 9, false, 0.4, 0.45, 0.5);

  // Footer Tagline
  addText('Rupadiya Travel - Rupadiya Hub Connecting India | Thank You For Choosing Rupadiya', 130, 80, 8, false, 0.5, 0.55, 0.6);

  // Compile PDF document structure
  const stream = content.join('\n');
  const streamLength = new TextEncoder().encode(stream).length;

  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${stream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000000 00000 n 
0000000000 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
${320 + streamLength}
%%EOF`;

  // Create Blob & Trigger Download
  const blob = new Blob([pdfString], { type: 'application/pdf' });
  const filename = `Ticket-${bookingId}.pdf`;

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
    }, 150);
  }

  return { blob, filename };
}

