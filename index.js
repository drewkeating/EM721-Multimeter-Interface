// em721.js  –  works with SerialPort v12.x or v14.x

const { SerialPort } = require("serialport");

/* -------- configuration ------------------------------------------------- */
const PORT = process.argv[2] || 'COM7';   // eg. '/dev/ttyUSB0' on Linux/Mac, 'COM4' on Windows
const BAUD = 2400;
/* ------------------------------------------------------------------------ */

const port = new SerialPort({ path: PORT, baudRate: BAUD });
const rxBuf = [];                           // running byte accumulator

/* little helper ---------------------------------------------------------- */
function bytesToHex(buf) { return buf.map(b => b.toString(16).padStart(2, '0')).join(' '); }

/* main serial handler ---------------------------------------------------- */
port.on('data', chunk => {
  for (const byte of chunk) rxBuf.push(byte);

  /* 1.  Strip any leading Simpson “scope header” (9 bytes, starts FF FF FF) */
  while (rxBuf.length >= 9 &&
         rxBuf[0] === 0xFF && rxBuf[1] === 0xFF && rxBuf[8] === 0x0A) {
    rxBuf.splice(0, 9);                     // discard it
  }
  
  /* 2.  Look for a complete 26‑byte frame ending in 0D 0A --------------- */
  while (rxBuf.length >= 26) {
    const lfIndex = rxBuf.findIndex((b, i) => b === 0x0D && rxBuf[i + 1] === 0x0A);
    if (lfIndex < 0) break;                 // no terminator yet

    const frame = rxBuf.splice(0, lfIndex + 2);   // includes CR/LF
    if (frame[0] !== 0x24 || frame.length !== 26) continue; // not a real frame
    decodeFrame(frame);
    
  }
});

/* ---------------------------------------------------------------------- */
/*  Decoder that covers *all* EM721 modes seen so far                     */
/* ---------------------------------------------------------------------- */
function decodeFrame(pkt) {
  /* ---------- A. pre‑decode common parts --------------------------- */
  const lead      = pkt.slice(1, 6);                 // sign / blanks area
  const sign      = lead.includes(0x2D);             // '‑' anywhere?
  const asciiFld  = Buffer.from(pkt.slice(5, 10)).toString('ascii');
  const overflow  = asciiFld.includes('OFL');
  const digitsRaw = overflow ? 0
                             : parseInt(asciiFld.replace(/\D/g, '') || '0', 10);

  const unitByte  = pkt[10];
  const funcByte  = pkt[11];
  const rangeByte = pkt[13];

  let mode = 'unknown', unit = '', shift = 3;

  /* ---------- B. Voltage (V & mV) ---------------------------------- */
  if (funcByte === 0x01 && (unitByte === 0xE8 || unitByte === 0xB8)) {
    unit = (unitByte === 0xB8) ? 'mV' : 'V';
    mode = (rangeByte === 0x40) ? 'voltage-ac' : 'voltage-dc';
    shift = (unit === 'mV')
              ? 2
              : ({ 0x00: 3, 0x40: 1, 0x80: 3 }[rangeByte & 0xF0] ?? 3);
  }

  /* ---------- C. Current (μA / mA / A) ----------------------------- */
  else if (funcByte === 0x02 && [0xA8, 0x98, 0xC8].includes(unitByte)) {
    mode = 'current';
    ({ 0xA8: ['μA', 3], 0x98: ['mA', 3], 0xC8: ['A', 4] })[unitByte]
      .forEach((v, i) => (i ? shift = v : unit = v));
  }

  /* ---------- D. Resistance ---------------------------------------- */
  else if (funcByte === 0x04 && unitByte === 0x38) {
    mode = 'resistance';
    unit = 'Ω';
    shift = 3;                                       // 5 ¾‑digit core
  }

  /* ---------- E. Capacitance --------------------------------------- */
  else if (funcByte === 0x10 && unitByte === 0x58) {
    mode = 'capacitance';
    unit = 'F';
    shift = 3;                                       // 0.1 % × 6000 counts
  }

  /* ---------- F. Diode / Continuity -------------------------------- */
  else if (unitByte === 0x78 && funcByte === 0x01) {
    mode = 'diode';
    unit = 'V';
    shift = 4;                                       // 1.999 V → 0–1999 mV
  }

  /* ---------- G. Frequency ----------------------------------------- */
  else if (unitByte === 0xD0 && funcByte === 0x08) {
    mode  = 'frequency';
    unit  = 'Hz';
    shift = 2;                                       // 6 kHz → decimal 1
  }

  /* ---------- H. Temperature --------------------------------------- */
  else if (unitByte === 0xD8 && (funcByte === 0x80 || funcByte === 0x81)) {
    mode  = 'temperature';
    unit  = (funcByte === 0x81) ? '°F' : '°C';
    shift = 2;                                       // 33.71 °C
  }

  /* ---------- I. compute numeric value ----------------------------- */
  let value = overflow ? NaN : digitsRaw / 10 ** shift;
  if (sign) value = -value;

  /* ---------- J. friendly auto‑prefix for Ω / F / Hz --------------- */
  if (mode === 'resistance') {
    if (value >= 1e6) { value /= 1e6; unit = 'MΩ'; }
    else if (value >= 1e3) { value /= 1e3; unit = 'kΩ'; }
  } else if (mode === 'capacitance') {
    if (value < 1e-9) { value *= 1e12; unit = 'pF'; }
    else if (value < 1e-6) { value *= 1e9; unit = 'nF'; }
    else if (value < 1e-3) { value *= 1e6; unit = 'µF'; }
    else { value *= 1e3; unit = 'mF'; }
  } else if (mode === 'frequency' && value >= 1000) {
    value /= 1000; unit = 'kHz';
  }

  /* ---------- K. flags --------------------------------------------- */
  const sample = {
    ts      : Date.now(),
    mode,
    unit,
    value,
    overflow,
    hold    : !!(pkt[17] & 0x01),
  };

  console.log(sample);
}

/* -------------------------------------------------------------------- */

// Handle errors
port.on('error', (err) => {
  console.error('Serial error:', err.message);
});


port.on('open', () => {
  console.log(`EM72: listening on ${PORT} @ ${BAUD} baud… (ctrl-C to quit)`);
});


port.on('close', () => {
  console.error(`Serial disconnected on port: ${PORT}`);
  open(); // reopen 
});



function open () {
  port.open(function (err) {
      if (!err)
         return;

      console.log('Port is not open: ' + err.message);
      setTimeout(open, 2000); // next attempt to open after 10s
  });
}