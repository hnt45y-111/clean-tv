// أجهزة محاكاة للاختبار فقط (يُحمَّل عبر PS_TEST_HW).
const fs = require('fs'); const fx = require('../tests/fixtures');
module.exports = {
  listPrinters: async () => [{ name: 'Brother DCP-T310', driver: 'Brother DCP-T310 Printer', port: 'USB001', isDefault: true, state: 'ready', statusText: 'جاهزة' }, { name: 'Canon LBP3010', driver: 'Canon LBP3010', port: 'USB002', isDefault: false, state: 'offline', statusText: 'غير متصلة' }],
  listScanners: async () => [{ id: 'wia-1', name: 'Brother DCP-T310 (محاكاة)', ready: true, error: '' }],
  scan: async (o) => { const f = o.outBase + '.png'; fs.writeFileSync(f, await fx.letterPng()); return [f]; },
  connectedDevices: async () => [{ name: 'Brother DCP-T310', class: 'Image', status: 'OK', id: 'USB\\1', manufacturer: 'Brother' }, { name: 'Canon G3020 series', class: 'Printer', status: 'OK', id: 'USB\\2', manufacturer: 'Canon' }],
  openSettings: async () => ({ ok: true }), addPrinterWizard: async () => ({ ok: true }),
  printerJobs: async () => [], cancelJob: async () => ({ ok: true }), openQueue: async () => ({ ok: true }), openProperties: async () => ({ ok: true }),
};
