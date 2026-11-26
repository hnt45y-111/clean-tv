'use strict';
const MM = { A3: [297, 420], A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
function sizeMm(name, orientation = 'portrait') {
  const [w, h] = MM[name] || MM.A4;
  return orientation === 'landscape' ? { w: h, h: w } : { w, h };
}
const mmToPt = (mm) => (mm * 72) / 25.4;
const mmToTwip = (mm) => Math.round((mm * 1440) / 25.4);
const mmToEmu = (mm) => Math.round(mm * 36000);
const mmToPx = (mm, dpi) => Math.round((mm * dpi) / 25.4);
module.exports = { MM, sizeMm, mmToPt, mmToTwip, mmToEmu, mmToPx };
