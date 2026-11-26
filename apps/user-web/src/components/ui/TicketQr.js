'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Signed boarding QR for a ticket. The bus manager scans it in the manager app.
 */
export default function TicketQr({ value, size = 120, className = '' }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!value) return undefined;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [value, size]);

  if (!value || !src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt="Boarding QR code — show to the bus manager" className={className} />
  );
}
