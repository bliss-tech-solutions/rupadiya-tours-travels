// Client-side helper for 35 franchise companies
export const FRANCHISE_COMPANIES = [
  { code: 1, shortCode: 'BDTT', name: 'Bageshwari Darshan Tours and Travels', shareCapital: 650000 },
  { code: 2, shortCode: 'BTT', name: 'Baijnath Tours and Travels', shareCapital: 215000 },
  { code: 3, shortCode: 'PDTT', name: 'Pashupati Darshan Tours and Travels', shareCapital: 650000 },
  { code: 4, shortCode: 'JBLTT', name: 'Jai Balaji Tours and Travels', shareCapital: 408000 },
  { code: 5, shortCode: 'JKTT', name: 'Jai Krishna Tours and Travels', shareCapital: 160000 },
  { code: 6, shortCode: 'KKTT', name: 'Kalika Karnali Tours and Travels', shareCapital: 134250 },
  { code: 7, shortCode: 'LSTT', name: 'Lord Siddhartha Tours and Travels', shareCapital: 172500 },
  { code: 8, shortCode: 'MNTT', name: 'Manav Tours and Travels', shareCapital: 200000 },
  { code: 9, shortCode: 'MHTT', name: 'Mahabu Tours and Travels', shareCapital: 212500 },
  { code: 10, shortCode: 'MTR', name: 'Malika Tours and Travels', shareCapital: 550000 },
  { code: 11, shortCode: 'NTT', name: 'Nepalgunj Tours and Travels', shareCapital: 650000 },
  { code: 12, shortCode: 'PTT', name: 'Panchakoshi Tours and Travels', shareCapital: 470000 },
  { code: 13, shortCode: 'DLTT', name: 'Dailekhi Tours and Travels', shareCapital: 171000 },
  { code: 14, shortCode: 'SBLTT', name: 'Shubha Bhagya Laxmi Tours and Travels', shareCapital: 153000 },
  { code: 15, shortCode: 'SSTT', name: 'Surkhet Tours and Travels', shareCapital: 500000 },
  { code: 16, shortCode: 'SRTT', name: 'Shri Ram Tours and Travels', shareCapital: 190000 },
  { code: 17, shortCode: 'STT', name: 'Simtali Tours and Travels', shareCapital: 650000 },
  { code: 18, shortCode: 'VTT', name: 'Vapi Tours and Travels', shareCapital: 250000 },
  { code: 19, shortCode: 'ATT', name: 'Aman Tours and Travels', shareCapital: 300000 },
  { code: 20, shortCode: 'BLTT', name: 'Bhagya Laxmi Tours and Travels', shareCapital: 340000 },
  { code: 21, shortCode: 'MKTT', name: 'Mahakailash Tours and Travels', shareCapital: 421000 },
  { code: 22, shortCode: 'KGTT', name: 'Karnali Gaurav Tours and Travels', shareCapital: 105500 },
  { code: 23, shortCode: 'RRTT', name: 'Radhe Radhe Tours and Travels', shareCapital: 64500 },
  { code: 24, shortCode: 'RSTT', name: 'Royal Simtali Tours and Travels', shareCapital: 200000 },
  { code: 25, shortCode: 'SLTT', name: 'Salyani Tours and Travels', shareCapital: 250000 },
  { code: 26, shortCode: 'SSHKTT', name: 'Shiva Shakti Tours and Travels', shareCapital: 390000 },
  { code: 27, shortCode: 'HKTT', name: 'Hamro Karnali Tours and Travels', shareCapital: 130000 },
  { code: 28, shortCode: 'OTT', name: 'Omika Tours and Travels', shareCapital: 90000 },
  { code: 29, shortCode: 'KDTT', name: 'Kailash Darshan Tours and Travels', shareCapital: 75000 },
  { code: 30, shortCode: 'RNTT', name: 'Royal Naumule Tours and Travels', shareCapital: 252000 },
  { code: 31, shortCode: 'SRDTT', name: 'Jai Shriram Darshan Tours and Travels', shareCapital: 30300 },
  { code: 32, shortCode: 'NHS', name: 'Mahasangh Transport', shareCapital: 140000 },
  { code: 33, shortCode: 'GENG', name: 'Narayan Bhandari Logistics', shareCapital: 35000 },
  { code: 34, shortCode: 'FTT', name: 'Vishnu Sharma Travels', shareCapital: 30000 },
  { code: 35, shortCode: 'HBG', name: 'Vishnu Khatri (HBG) Transport', shareCapital: 30000 }
];

export function getFranchiseByCode(code) {
  const num = parseInt(code, 10);
  return FRANCHISE_COMPANIES.find(c => c.code === num) || null;
}
