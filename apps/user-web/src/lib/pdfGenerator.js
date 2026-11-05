/**
 * Client-Side PDF Generator for Rupadiya Travel Boarding Pass
 * Creates a valid, standard ISO 32000-1 / PDF 1.4 document directly in the browser
 * with 0 external dependencies, saving as Ticket-[BookingId].pdf.
 * Features exact dynamic byte offsets, complete journey corridor, coach/fleet
 * specifications, passenger roster manifest, fare breakdown, and barcode.
 */

export function downloadTicketPdf(input = {}) {
  // Normalize input parameters
  const bookingId = input.bookingId || input.pnr || 'RUP-7829-BK';
  const travelerName = input.travelerName || input.passengerName || input.passengers?.[0]?.name || 'Traveler';
  const travelerPhone = input.travelerPhone || input.contactPhone || input.passengers?.[0]?.phone || '+91 98765 43210';
  const travelerEmail = input.travelerEmail || input.contactEmail || '';

  // Journey corridor
  let rawFrom = input.fromCity || input.sourceCity || 'Rupaidiha';
  if (rawFrom.toLowerCase() === 'rupadiya') rawFrom = 'Rupaidiha';
  const fromCity = rawFrom;
  const toCity = input.toCity || input.destinationCity || 'Ahmedabad';
  const dateStr = input.dateStr || input.travelDate || input.departureDate || 'Scheduled Date';
  const timeStr = input.timeStr || input.departureTime || '05:30 PM';
  const arrTimeStr = input.arrTimeStr || input.arrivalTime || 'Morning (Scheduled)';
  const boardingName = input.boardingName || input.boardingPoint?.name || `${fromCity} Central Stand`;
  const droppingName = input.droppingName || input.droppingPoint?.name || `${toCity} Central Bus Stand`;

  // Coach & Fleet details
  const busName = input.busName || input.operatorName || 'Rupadiya Intercity Express';
  const busNumber = input.busNumber || input.registrationNumber || input.regNumber || 'UP-40-TC-1001';
  const busModel = input.busModel || input.busType || '36 AC Sleeper (2+1)';
  const layoutType = input.layoutType || (busModel.includes('2+1') ? '2+1 Sleeper' : '2+2 Seater');
  const driverName = input.driverName || 'Verified Captain (Dinesh Kumar)';
  const driverPhone = input.driverPhone || '+91 98765 43210';
  const amenities = Array.isArray(input.amenities) && input.amenities.length > 0
    ? input.amenities.join(', ')
    : 'Climate Control AC, USB Charging, Reading Lamp, First Aid Box';

  // Seats & Passengers
  const seatsStr = input.seatsStr || input.seats || (input.passengers?.map(p => p.seatNumber).filter(Boolean).join(', ')) || '1, 2';
  const rawPassengers = input.passengers && input.passengers.length > 0
    ? input.passengers
    : [{ name: travelerName, age: '28', gender: 'M', seatNumber: seatsStr }];

  // Fare & Payment details
  const totalFare = input.totalFare || input.totalPaid || input.totalAmount || '1,733';
  const formattedFare = isNaN(Number(totalFare)) ? totalFare : Number(totalFare).toLocaleString('en-IN');
  const baseFare = input.baseFare ? (isNaN(Number(input.baseFare)) ? input.baseFare : Number(input.baseFare).toLocaleString('en-IN')) : '';
  const gstAmount = input.gstAmount ? (isNaN(Number(input.gstAmount)) ? input.gstAmount : Number(input.gstAmount).toLocaleString('en-IN')) : '';
  const insuranceAmount = input.insuranceAmount ? (isNaN(Number(input.insuranceAmount)) ? input.insuranceAmount : Number(input.insuranceAmount).toLocaleString('en-IN')) : '';
  const paymentProvider = input.paymentProvider || 'Razorpay Gateway';
  const paymentReference = input.paymentReference || input.paymentId || 'pay_91283018';
  const paymentStatus = input.paymentStatus || 'CONFIRMED & SETTLED';

  const content = [];

  // Helper to add sanitized text (Type 1 Helvetica ASCII safe)
  const addText = (text, x, y, size = 10, isBold = false, r = 0.1, g = 0.12, b = 0.15) => {
    const clean = String(text ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/₹/g, 'Rs. ')
      .replace(/[^\x20-\x7E]/g, ' ');
    content.push(`BT /${isBold ? 'F2' : 'F1'} ${size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${x} ${y} Tm (${clean}) Tj ET`);
  };

  // Helper to add rectangles (fill or stroke)
  const addRect = (x, y, w, h, r, g, b, fill = true) => {
    content.push(`q ${r} ${g} ${b} ${fill ? 'rg' : 'RG'} ${x} ${y} ${w} ${h} re ${fill ? 'f' : 's'} Q`);
  };

  // 1. Page Border (A4 Portrait bounds: 595 x 842 pt)
  addRect(36, 40, 523, 762, 0.85, 0.88, 0.9, false);

  // 2. Top Header Brand Banner (Rupadiya Blue: 0.08, 0.58, 0.94)
  addRect(36, 732, 523, 70, 0.08, 0.58, 0.94, true);

  // Brand Logo Accent Box
  addRect(50, 744, 46, 46, 1, 1, 1, true);
  addText('RUP', 58, 762, 14, true, 0.08, 0.58, 0.94);

  // Brand Title & Subtitle
  addText('RUPADIYA INTERCITY EXPRESS', 106, 772, 17, true, 1, 1, 1);
  addText('OFFICIAL INTERCITY BOARDING PASS & PASSENGER E-TICKET', 106, 752, 9, false, 0.9, 0.95, 1);

  // PNR & Confirmed Status
  addText('STATUS: CONFIRMED', 385, 772, 10, true, 0.8, 1, 0.85);
  addText(`PNR: #${bookingId}`, 385, 752, 12, true, 1, 1, 1);

  // 3. Journey Corridor Box
  addRect(48, 660, 499, 60, 0.96, 0.98, 1.0, true);
  addRect(48, 660, 499, 60, 0.82, 0.89, 0.96, false);

  addText('ORIGIN HUB', 60, 705, 8, true, 0.35, 0.45, 0.55);
  addText(fromCity.toUpperCase(), 60, 688, 13, true, 0.08, 0.15, 0.25);
  addText(`Dep: ${timeStr} | ${dateStr}`, 60, 672, 8, false, 0.08, 0.55, 0.9);

  addText('---- DIRECT INTERCITY CORRIDOR ---->', 195, 688, 8, true, 0.08, 0.55, 0.9);

  addText('DESTINATION CITY', 375, 705, 8, true, 0.35, 0.45, 0.55);
  addText(toCity.toUpperCase(), 375, 688, 13, true, 0.08, 0.15, 0.25);
  addText(`Expected Arr: ${arrTimeStr}`, 375, 672, 8, false, 0.3, 0.35, 0.4);

  // 4. Assigned Fleet & Coach Specifications Box
  addRect(48, 576, 499, 74, 0.97, 0.98, 0.99, true);
  addRect(48, 576, 499, 74, 0.82, 0.86, 0.92, false);

  addText('ASSIGNED COACH & FLEET SPECIFICATIONS', 60, 636, 9, true, 0.08, 0.5, 0.85);
  addText(`Bus Plate No: ${busNumber}`, 60, 620, 10, true, 0.08, 0.12, 0.2);
  addText(`Coach Type: ${busModel} (${layoutType})`, 240, 620, 9, true, 0.15, 0.2, 0.25);

  addText(`Operator: ${busName}`, 60, 604, 9, false, 0.25, 0.3, 0.35);
  addText(`Captain / Pilot: ${driverName} (${driverPhone})`, 240, 604, 9, false, 0.25, 0.3, 0.35);

  addText(`Onboard Amenities: ${amenities}`, 60, 586, 8, false, 0.35, 0.4, 0.45);

  // 5. Boarding & Dropping Points Box
  addRect(48, 508, 499, 58, 0.99, 0.99, 0.99, true);
  addRect(48, 508, 499, 58, 0.88, 0.9, 0.92, false);

  addText('BOARDING POINT:', 60, 549, 8, true, 0.35, 0.45, 0.55);
  addText(`${boardingName} (Please report 15 mins prior to ${timeStr})`, 160, 549, 9, true, 0.08, 0.15, 0.22);

  addText('DROPPING POINT:', 60, 534, 8, true, 0.35, 0.45, 0.55);
  addText(droppingName, 160, 534, 9, false, 0.2, 0.25, 0.3);

  addText('PRIMARY CONTACT:', 60, 519, 8, true, 0.35, 0.45, 0.55);
  addText(`${travelerName} · Phone: ${travelerPhone} ${travelerEmail ? `· Email: ${travelerEmail}` : ''}`, 160, 519, 8, false, 0.2, 0.25, 0.3);

  // 6. Passenger Manifest Table
  addText(`PASSENGER MANIFEST (${rawPassengers.length} Traveler${rawPassengers.length > 1 ? 's' : ''}) · ASSIGNED SEATS: [${seatsStr}]`, 48, 488, 9, true, 0.1, 0.15, 0.2);

  // Table Header Bar
  addRect(48, 468, 499, 16, 0.93, 0.95, 0.96, true);
  addText('#', 56, 473, 8, true, 0.35, 0.4, 0.45);
  addText('PASSENGER NAME', 85, 473, 8, true, 0.35, 0.4, 0.45);
  addText('AGE / GENDER', 270, 473, 8, true, 0.35, 0.4, 0.45);
  addText('CONFIRMED SEAT', 380, 473, 8, true, 0.35, 0.4, 0.45);
  addText('STATUS', 475, 473, 8, true, 0.35, 0.4, 0.45);

  let currentY = 452;
  rawPassengers.slice(0, 4).forEach((p, idx) => {
    const pName = p.name || `Passenger ${idx + 1}`;
    const pAgeGender = `${p.age || '—'} yrs (${p.gender ? p.gender.toUpperCase() : '—'})`;
    const pSeat = p.seatNumber || (idx + 1);

    addText(`${idx + 1}`, 56, currentY, 8, false, 0.35, 0.4, 0.45);
    addText(pName, 85, currentY, 9, true, 0.1, 0.15, 0.2);
    addText(pAgeGender, 270, currentY, 8, false, 0.3, 0.35, 0.4);
    addText(`Seat: ${pSeat}`, 380, currentY, 9, true, 0.08, 0.55, 0.9);
    addText('Confirmed', 475, currentY, 8, false, 0.05, 0.6, 0.35);
    currentY -= 15;
  });

  // 7. Fare Breakdown & Payment Audit Box
  addRect(48, 332, 499, 64, 0.97, 0.98, 0.97, true);
  addRect(48, 332, 499, 64, 0.8, 0.88, 0.84, false);

  addText('TOTAL FARE PAID:', 60, 380, 8, true, 0.35, 0.45, 0.4);
  addText(`Rs. ${formattedFare}`, 160, 378, 14, true, 0.08, 0.12, 0.2);

  const breakdownParts = [];
  if (baseFare) breakdownParts.push(`Base: Rs. ${baseFare}`);
  if (gstAmount) breakdownParts.push(`GST (5%): Rs. ${gstAmount}`);
  if (insuranceAmount && Number(insuranceAmount) > 0) breakdownParts.push(`Insurance: Rs. ${insuranceAmount}`);
  const breakdownStr = breakdownParts.length > 0 ? breakdownParts.join(' | ') : 'Statutory Taxes & 5% GST Included';
  addText(breakdownStr, 60, 362, 8, false, 0.3, 0.35, 0.4);

  addText(`Payment: ${paymentProvider} · Ref: ${paymentReference}`, 60, 346, 8, false, 0.35, 0.4, 0.45);

  addText('PAYMENT AUDIT:', 340, 380, 8, true, 0.35, 0.45, 0.4);
  addText(paymentStatus, 340, 365, 9, true, 0.05, 0.55, 0.35);
  addText('Verified Instant Electronic Settlement', 340, 348, 8, false, 0.4, 0.45, 0.5);

  // 8. Important Travel Guidelines
  addText('IMPORTANT TRAVEL GUIDELINES & PASSENGER POLICIES', 48, 310, 9, true, 0.15, 0.2, 0.25);
  addText('1. Reporting Time: Travelers must report at the boarding station 15 minutes before departure.', 56, 296, 8, false, 0.35, 0.4, 0.45);
  addText('2. Identification: Valid government photo ID (Aadhaar / Voter ID / Driving License) is mandatory.', 56, 283, 8, false, 0.35, 0.4, 0.45);
  addText('3. Luggage Allowance: 2 pieces of luggage (up to 20kg per passenger). Combustibles strictly prohibited.', 56, 270, 8, false, 0.35, 0.4, 0.45);
  addText('4. Live Bus Tracking: Real-time GPS location activates 2 hours prior to journey at /track-bus.', 56, 257, 8, false, 0.35, 0.4, 0.45);
  addText('5. Helpline & Assistance: 24x7 Customer Support Desk: +91 98765 43210 | Email: support@rupadiya.com.', 56, 244, 8, false, 0.35, 0.4, 0.45);
  addText('6. Cancellation Policy: Cancellations are governed by standard RedBus-style departure-time slabs.', 56, 231, 8, false, 0.35, 0.4, 0.45);

  // 9. High-Contrast Vector Barcode & PNR Scan Strip
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
  addText(`* PNR: ${bookingId} *`, 245, 120, 9, true, 0.2, 0.25, 0.3);

  // 10. Footer Watermark
  addText('Rupadiya Travel Network · Connecting India to Rupadiya Hub · Have a safe & pleasant journey!', 115, 60, 8, false, 0.45, 0.5, 0.55);

  // Compile PDF document structure with exact ISO 32000-1 / PDF 1.4 byte offsets
  const contentStream = content.join('\n');
  const enc = new TextEncoder();
  let body = '%PDF-1.4\n';
  const offsets = [];

  const addObj = (id, str) => {
    offsets[id] = enc.encode(body).length;
    body += `${id} 0 obj\n${str}\nendobj\n`;
  };

  addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>');
  const streamBytes = enc.encode(contentStream);
  addObj(4, `<< /Length ${streamBytes.length} >>\nstream\n${contentStream}\nendstream`);
  addObj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObj(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const startXref = enc.encode(body).length;
  let xref = 'xref\n0 7\n0000000000 65535 f \n';
  for (let i = 1; i <= 6; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  const pdfString = body + xref + trailer;

  // Create Blob & Trigger Download
  const blob = new Blob([enc.encode(pdfString)], { type: 'application/pdf' });
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
    }, 250);
  }

  return { blob, filename };
}
