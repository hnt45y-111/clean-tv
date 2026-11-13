// حساب أوقات الصلاة محلياً (طريقة الجعفري: الفجر ١٦°، المغرب ٤°، العشاء ١٤°)
(function () {
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function sin(d) { return Math.sin(d * D2R); }
  function cos(d) { return Math.cos(d * D2R); }
  function tan(d) { return Math.tan(d * D2R); }
  function asin(x) { return Math.asin(x) * R2D; }
  function acos(x) { return Math.acos(Math.max(-1, Math.min(1, x))) * R2D; }
  function atan2(y, x) { return Math.atan2(y, x) * R2D; }
  function acot(x) { return Math.atan(1 / x) * R2D; }
  function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sunPos(jd) {
    var D = jd - 2451545.0;
    var g = fix(357.529 + 0.98560028 * D, 360);
    var q = fix(280.459 + 0.98564736 * D, 360);
    var L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    var e = 23.439 - 0.00000036 * D;
    var RA = atan2(cos(e) * sin(L), cos(L)) / 15;
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
  }

  // Returns times in hours (local clock) for the given date
  function compute(date, lat, lng, tz) {
    var jd = julian(date.y, date.m, date.d) - lng / (15 * 24);
    function midDay(t) { var eq = sunPos(jd + t).eqt; return fix(12 - eq, 24); }
    function angleTime(angle, t, ccw) {
      var decl = sunPos(jd + t).decl, noon = midDay(t);
      var T = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
      return noon + (ccw ? -T : T);
    }
    function asrTime(factor, t) {
      var decl = sunPos(jd + t).decl, angle = -acot(factor + tan(Math.abs(lat - decl)));
      return angleTime(angle, t, false);
    }
    // two-pass refinement using approximate times as day fractions
    var t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
    for (var i = 0; i < 2; i++) {
      var f = {}; for (var k in t) f[k] = t[k] / 24;
      t = {
        fajr: angleTime(16, f.fajr, true),
        sunrise: angleTime(0.833, f.sunrise, true),
        dhuhr: midDay(f.dhuhr),
        asr: asrTime(1, f.asr),
        sunset: angleTime(0.833, f.sunset, false),
        maghrib: angleTime(4, f.maghrib, false),
        isha: angleTime(14, f.isha, false)
      };
    }
    var adj = tz - lng / 15, out = {};
    for (var n in t) out[n] = t[n] + adj;
    out.midnight = out.sunset + fix(out.fajr + 24 - out.sunset, 24) / 2; // Shia midnight: sunset→fajr
    return out;
  }

  window.PRAY = { compute: compute };

  window.CITIES = [
    ['بغداد', 33.3152, 44.3661], ['كربلاء', 32.6160, 44.0249], ['النجف', 32.0259, 44.3462],
    ['الكوفة', 32.0346, 44.4011], ['الكاظمية', 33.3800, 44.3370], ['البصرة', 30.5085, 47.7804],
    ['الحلة', 32.4637, 44.4196], ['الكوت', 32.5128, 45.8182], ['العمارة', 31.8356, 47.1440],
    ['الناصرية', 31.0439, 46.2573], ['الديوانية', 31.9929, 44.9255], ['السماوة', 31.3099, 45.2803],
    ['سامراء', 34.1959, 43.8857], ['بعقوبة', 33.7466, 44.6437], ['الرمادي', 33.4206, 43.3078],
    ['الموصل', 36.3350, 43.1189], ['كركوك', 35.4681, 44.3922], ['أربيل', 36.1911, 44.0092],
    ['السليمانية', 35.5613, 45.4374], ['دهوك', 36.8669, 42.9503]
  ];
})();
