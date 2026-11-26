'use strict';
// تكامل Windows الحقيقي: الطابعات (WMI/PrintManagement) والسكانر (WIA عبر COM).
// تُنفَّذ سكربتات PowerShell بـ -EncodedCommand والمعاملات عبر متغيّر بيئة JSON (لا تركيب أوامر من مدخلات المستخدم).
const { execFile } = require('child_process');

const PRE = `$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.Encoding]::UTF8;$A=$null;if($env:PS_ARGS){$A=$env:PS_ARGS|ConvertFrom-Json};`;

const SCRIPTS = {
  printersList: `
$all=@(Get-CimInstance Win32_Printer)
$out=@($all|ForEach-Object{[pscustomobject]@{name=[string]$_.Name;driver=[string]$_.DriverName;port=[string]$_.PortName;isDefault=[bool]$_.Default;network=[bool]$_.Network;shared=[bool]$_.Shared;offline=[bool]$_.WorkOffline;status=[int]$_.PrinterStatus;errorState=[int]$_.DetectedErrorState;location=[string]$_.Location}})
ConvertTo-Json -InputObject $out -Compress -Depth 4`,
  printerJobs: `
$jobs=@(Get-PrintJob -PrinterName $A.name -ErrorAction Stop|ForEach-Object{[pscustomobject]@{id=[int]$_.Id;document=[string]$_.DocumentName;user=[string]$_.UserName;status=[string]$_.JobStatus;pages=[int]$_.TotalPages;size=[long]$_.Size;submitted=[string]$_.SubmittedTime}})
ConvertTo-Json -InputObject $jobs -Compress -Depth 4`,
  printerCancelJob: `
Remove-PrintJob -PrinterName $A.name -ID ([int]$A.id) -ErrorAction Stop
ConvertTo-Json -InputObject ([pscustomobject]@{ok=$true}) -Compress`,
  printUi: `
$n=[string]$A.name
if($n.Contains('"')){throw 'اسم طابعة غير صالح'}
$mode=[string]$A.mode
if(@('/o','/e')-notcontains $mode){throw 'وضع غير صالح'}
Start-Process -FilePath rundll32.exe -ArgumentList ('printui.dll,PrintUIEntry '+$mode+' /n"'+$n+'"')
ConvertTo-Json -InputObject ([pscustomobject]@{ok=$true}) -Compress`,
  scannersList: `
$out=@()
try{$dm=New-Object -ComObject WIA.DeviceManager}catch{throw 'WIA_UNAVAILABLE'}
foreach($d in $dm.DeviceInfos){
  if($d.Type -ne 1){continue}
  $name='';$ready=$false;$err=''
  try{$name=[string]$d.Properties.Item('Name').Value}catch{}
  try{$dev=$d.Connect();$ready=$true}catch{$err=[string]$_.Exception.HResult}
  $out+=[pscustomobject]@{id=[string]$d.DeviceID;name=$name;ready=$ready;error=$err}
}
ConvertTo-Json -InputObject @($out) -Compress -Depth 4`,
  scan: `
function SetProp($o,$id,$val){foreach($p in $o.Properties){if($p.PropertyID -eq $id){try{$p.Value=[int]$val}catch{};return}}}
function MaxOf($o,$id){foreach($p in $o.Properties){if($p.PropertyID -eq $id){try{return [int]$p.SubTypeMax}catch{return 0}}};return 0}
$dm=New-Object -ComObject WIA.DeviceManager
$info=$null;foreach($d in $dm.DeviceInfos){if($d.Type -eq 1 -and $d.DeviceID -eq $A.id){$info=$d}}
if(-not $info){throw 'SCANNER_NOT_FOUND'}
$dev=$info.Connect()
$item=$dev.Items.Item(1)
$intent=@{color=1;gray=2;bw=4}[[string]$A.color]
SetProp $item 6146 $intent
SetProp $item 6147 $A.dpi
SetProp $item 6148 $A.dpi
SetProp $item 6149 0
SetProp $item 6150 0
$wpx=[int]([double]$A.widthIn*[int]$A.dpi);$hpx=[int]([double]$A.heightIn*[int]$A.dpi)
$mw=MaxOf $item 6151;$mh=MaxOf $item 6152
if($mw -gt 0 -and $wpx -gt $mw){$wpx=$mw};if($mh -gt 0 -and $hpx -gt $mh){$hpx=$mh}
SetProp $item 6151 $wpx
SetProp $item 6152 $hpx
$fmt='{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}'
$files=@()
if($A.source -eq 'feeder'){
  foreach($p in $dev.Properties){if($p.PropertyID -eq 3088){try{$p.Value=1}catch{}}}
  $i=0
  while($true){
    try{$img=$item.Transfer($fmt)}catch{if($_.Exception.HResult -eq -2145320957){break}else{throw}}
    $i++;$f=([string]$A.outBase)+'-'+$i+'.png';if(Test-Path $f){Remove-Item $f -Force};$img.SaveFile($f);$files+=$f
    if($i -ge 500){break}
  }
}else{
  $img=$item.Transfer($fmt);$f=[string]$A.outBase+'.png';if(Test-Path $f){Remove-Item $f -Force};$img.SaveFile($f);$files+=$f
}
ConvertTo-Json -InputObject ([pscustomobject]@{files=@($files)}) -Compress`,
};

const PRINTER_STATUS = { 1: 'غير محدد', 2: 'غير معروفة', 3: 'جاهزة', 4: 'تطبع الآن', 5: 'قيد التهيئة', 6: 'متوقفة', 7: 'غير متصلة' };
const PRINTER_ERROR = { 3: 'الورق على وشك النفاد', 4: 'لا يوجد ورق', 5: 'الحبر/التونر على وشك النفاد', 6: 'لا يوجد حبر/تونر', 7: 'باب الطابعة مفتوح', 8: 'انحشار ورق', 9: 'غير متصلة', 10: 'تحتاج إلى صيانة', 11: 'حاوية الإخراج ممتلئة' };
const WIA_ERRORS = {
  '80210001': 'خطأ غير معروف من السكانر', '80210002': 'انحشار ورق في السكانر', '80210003': 'لا توجد أوراق في المغذّي', '80210004': 'مشكلة في الورق',
  '80210005': 'السكانر غير متصل أو مغلق', '80210006': 'السكانر مشغول، حاول بعد قليل', '80210007': 'السكانر قيد التسخين، انتظر لحظات', '80210008': 'يحتاج السكانر إلى تدخّل المستخدم',
  '8021000A': 'تعذّر الاتصال بالسكانر — تحقق من الكابل والتشغيل', '8021000C': 'إعداد غير مدعوم من هذا السكانر (جرّب دقة/حجماً آخر)', '8021000D': 'السكانر مقفول من برنامج آخر',
  '8021000E': 'خطأ في تعريف السكانر', '80210015': 'لم يُعثر على سكانر متصل', '80210016': 'غطاء السكانر مفتوح', '80210017': 'مصباح السكانر مطفأ',
};

function mapWiaError(msg) {
  const s = String(msg || '');
  if (/WIA_UNAVAILABLE/.test(s)) return 'خدمة WIA غير متاحة على هذا الجهاز';
  if (/SCANNER_NOT_FOUND/.test(s)) return 'السكانر المحدد لم يعد متصلاً';
  const m = s.match(/0x?(8021[0-9A-Fa-f]{4})/) ; if (m && WIA_ERRORS[m[1].toUpperCase()]) return WIA_ERRORS[m[1].toUpperCase()];
  const n = s.match(/-?2145\d{6}/); if (n) { const h = ((parseInt(n[0], 10) >>> 0).toString(16)).toUpperCase(); if (WIA_ERRORS[h]) return WIA_ERRORS[h]; }
  return 'فشل المسح: ' + s.split('\n')[0].slice(0, 200);
}

function decodePrinter(p) {
  const err = PRINTER_ERROR[p.errorState] || '';
  let state = 'ready', text = PRINTER_STATUS[p.status] || 'غير معروفة';
  if (p.offline || p.status === 7 || p.errorState === 9) { state = 'offline'; text = 'غير متصلة'; }
  else if (err && p.errorState >= 4 && p.errorState !== 5) { state = 'error'; text = err; }
  else if (p.status === 4) state = 'busy';
  else if (p.status === 6) { state = 'error'; text = 'متوقفة'; }
  return { ...p, state, statusText: text, warning: err && state !== 'error' && state !== 'offline' ? err : '' };
}

class WinHW {
  constructor({ platform = process.platform, run } = {}) { this.platform = platform; this._run = run || this._exec.bind(this); }
  _exec(script, args, timeout) {
    return new Promise((resolve, reject) => {
      const enc = Buffer.from(PRE + script, 'utf16le').toString('base64');
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc],
        { timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PS_ARGS: args ? JSON.stringify(args) : '' } },
        (err, stdout, stderr) => { if (err) { const e = new Error((stderr || err.message || '').trim()); e.code = err.code; return reject(e); } resolve(stdout); });
    });
  }
  _win() { if (this.platform !== 'win32') { const e = new Error('هذه الميزة تعمل على Windows فقط'); e.unsupported = true; throw e; } }
  async _json(name, args, timeout = 30000) {
    this._win(); const out = (await this._run(SCRIPTS[name], args, timeout)).trim();
    return out ? JSON.parse(out) : null;
  }
  async listPrinters() { const r = await this._json('printersList'); return (Array.isArray(r) ? r : r ? [r] : []).map(decodePrinter); }
  async printerJobs(name) { const r = await this._json('printerJobs', { name }); return Array.isArray(r) ? r : r ? [r] : []; }
  async cancelJob(name, id) { return this._json('printerCancelJob', { name, id }); }
  async openQueue(name) { return this._json('printUi', { name, mode: '/o' }); }
  async openProperties(name) { return this._json('printUi', { name, mode: '/e' }); }
  async listScanners() {
    try { const r = await this._json('scannersList', null, 45000); return (Array.isArray(r) ? r : r ? [r] : []).map((s) => ({ ...s, errorText: s.error ? mapWiaError(s.error) : '' })); }
    catch (e) { if (e.unsupported) throw e; throw new Error(mapWiaError(e.message)); }
  }
  /** يمسح صفحة واحدة (أو كل المغذّي). يعيد قائمة ملفات PNG. */
  async scan({ id, dpi = 300, color = 'color', widthIn = 8.27, heightIn = 11.69, source = 'flatbed', outBase }) {
    try { const r = await this._json('scan', { id, dpi, color, widthIn, heightIn, source, outBase }, 300000); return r.files || []; }
    catch (e) { if (e.unsupported) throw e; throw new Error(mapWiaError(e.message)); }
  }
}
module.exports = { WinHW, decodePrinter, mapWiaError, SCRIPTS };
