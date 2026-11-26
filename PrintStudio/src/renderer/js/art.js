// رسوم السكانر والطابعة بأسلوب الكوميكس (SVG مضمّن، بلا ملفات خارجية).
export const scannerArt = `<svg class="art" viewBox="0 0 520 330" role="img" aria-label="سكانر">
<defs><linearGradient id="sg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f6bff"/><stop offset="1" stop-color="#18246e"/></linearGradient>
<linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe9ff"/><stop offset="1" stop-color="#2f7bff"/></linearGradient>
<pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#fff" opacity=".35"/></pattern></defs>
<ellipse cx="260" cy="300" rx="210" ry="18" fill="#000" opacity=".45"/>
<path d="M60 190 L130 70 H420 L470 190 Z" fill="url(#sg1)" stroke="#000" stroke-width="6" stroke-linejoin="round"/>
<path d="M92 184 L146 86 H404 L442 184 Z" fill="url(#sg2)" stroke="#000" stroke-width="5" stroke-linejoin="round" opacity=".92"/>
<path d="M92 184 L146 86 H404 L442 184 Z" fill="url(#dots)"/>
<rect x="190" y="104" width="130" height="84" rx="4" fill="#fff" stroke="#000" stroke-width="4" transform="rotate(-6 255 146)"/>
<g stroke="#2a3b90" stroke-width="4" stroke-linecap="round" transform="rotate(-6 255 146)"><path d="M204 122h60M204 136h100M204 150h92M204 164h70"/></g>
<rect x="40" y="186" width="440" height="96" rx="18" fill="url(#sg1)" stroke="#000" stroke-width="6"/>
<rect x="64" y="236" width="392" height="12" rx="6" fill="#050816" stroke="#000" stroke-width="3"/>
<circle cx="86" cy="212" r="9" fill="#22c55e" stroke="#000" stroke-width="3"/><circle cx="116" cy="212" r="9" fill="#19d3ff" stroke="#000" stroke-width="3"/>
<rect x="380" y="203" width="76" height="18" rx="9" fill="#050816" stroke="#000" stroke-width="3"/>
<path d="M40 190h440" stroke="#9fd0ff" stroke-width="3" opacity=".55"/>
<g fill="#fff"><path d="M440 40l8 18 18 8-18 8-8 18-8-18-18-8 18-8z" opacity=".9"/><path d="M70 60l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" opacity=".7"/></g>
</svg>`;
export const printerArt = `<svg viewBox="0 0 64 64" fill="none" stroke="#9fd0ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 24V8h28v16"/><rect x="6" y="24" width="52" height="22" rx="5" fill="#16318f"/><rect x="16" y="38" width="32" height="18" fill="#fff" stroke="#9fd0ff"/><path d="M22 44h20M22 50h14"/><circle cx="48" cy="31" r="2" fill="#22c55e" stroke="none"/></svg>`;
