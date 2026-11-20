// رسوم الشخصيات والشعار: SVG أصلية بأسلوب هندسي موحّد (ظل + أضلاع حادة + لمسة لون الدور).
import { raw } from './dom.js';

export const ROLE_COLOR = { mafia: '#D9233C', doctor: '#21A875', detective: '#2478E8', sniper: '#A45BE7', citizen: '#E8AE42' };
export const ROLE_ICON = { mafia: 'skull', doctor: 'med', detective: 'search', sniper: 'target', citizen: 'shield' };
export const TEAM_OF = { mafia: 'mafia', doctor: 'town', detective: 'town', sniper: 'town', citizen: 'town' };

const BUST = (c) => `<defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2450"/><stop offset="1" stop-color="#0a0f24"/></linearGradient>
<radialGradient id="gl" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>
<circle cx="60" cy="68" r="58" fill="url(#gl)"/>
<path d="M12 140c0-30 20-46 48-46s48 16 48 46z" fill="url(#gb)" stroke="${c}" stroke-opacity=".55" stroke-width="2"/>
<rect x="50" y="78" width="20" height="18" rx="5" fill="#cfd8ee"/><ellipse cx="60" cy="58" rx="22" ry="25" fill="#dbe4f6"/>`;
const EXTRA = {
  mafia: (c) => `<path d="M26 46h68l-9-12c-6-8-14-12-25-12s-19 4-25 12z" fill="#10152d" stroke="${c}" stroke-width="2"/><rect x="20" y="44" width="80" height="9" rx="4.5" fill="${c}"/>
    <rect x="38" y="56" width="18" height="9" rx="4.5" fill="#0a0f24"/><rect x="64" y="56" width="18" height="9" rx="4.5" fill="#0a0f24"/><path d="M56 60h8" stroke="#0a0f24" stroke-width="3"/>
    <path d="M52 94l8 14 8-14-8 4z" fill="${c}"/><path d="M60 98l-6 10 6 22 6-22z" fill="${c}" opacity=".85"/><path d="M52 74c4 3 12 3 16 0" stroke="#0a0f24" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  doctor: (c) => `<path d="M30 40c0-12 13-19 30-19s30 7 30 19z" fill="#e9f7f1"/><rect x="52" y="26" width="16" height="4" rx="2" fill="${c}"/><rect x="58" y="20" width="4" height="16" rx="2" fill="${c}"/>
    <circle cx="51" cy="58" r="3" fill="#0a0f24"/><circle cx="69" cy="58" r="3" fill="#0a0f24"/><path d="M53 70c4 3 10 3 14 0" stroke="#0a0f24" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M38 98c0 14 8 20 14 20s14-6 14-20" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><circle cx="66" cy="118" r="5" fill="none" stroke="${c}" stroke-width="3.5"/><path d="M84 112h12M90 106v12" stroke="#e9f7f1" stroke-width="5" stroke-linecap="round"/>`,
  detective: (c) => `<path d="M24 46h72l-6-10c-5-9-16-14-30-14s-25 5-30 14z" fill="#10152d" stroke="${c}" stroke-width="2"/><path d="M24 46c12 6 60 6 72 0v5c-12 6-60 6-72 0z" fill="${c}"/>
    <circle cx="51" cy="60" r="3" fill="#0a0f24"/><circle cx="69" cy="60" r="3" fill="#0a0f24"/><path d="M54 72h12" stroke="#0a0f24" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M30 96l14 24-4 20M90 96L76 120l4 20" stroke="${c}" stroke-width="2.5" fill="none"/><circle cx="92" cy="104" r="12" fill="#0a0f24" fill-opacity=".5" stroke="${c}" stroke-width="3.5"/><path d="M101 113l12 12" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
  sniper: (c) => `<path d="M24 62c0-26 14-42 36-42s36 16 36 42c0 10-6 16-12 18V60c0-12-10-20-24-20s-24 8-24 20v20c-6-2-12-8-12-18z" fill="#10152d" stroke="${c}" stroke-width="2"/>
    <path d="M42 58h36v8H42z" fill="#0a0f24"/><circle cx="52" cy="62" r="3" fill="${c}"/><circle cx="68" cy="62" r="3" fill="${c}"/>
    <circle cx="86" cy="58" r="14" fill="none" stroke="${c}" stroke-width="2.5"/><path d="M86 38v10M86 68v10M66 58h10M96 58h10" stroke="${c}" stroke-width="2.5"/><circle cx="86" cy="58" r="2.4" fill="${c}"/>`,
  citizen: (c) => `<path d="M32 44c2-14 14-22 28-22s26 8 28 22z" fill="${c}" opacity=".95"/><rect x="26" y="42" width="68" height="8" rx="4" fill="#b8841f"/>
    <circle cx="51" cy="60" r="3" fill="#0a0f24"/><circle cx="69" cy="60" r="3" fill="#0a0f24"/><path d="M52 71c5 4 11 4 16 0" stroke="#0a0f24" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M44 98l16 10 16-10" fill="none" stroke="#dbe4f6" stroke-width="3.5" stroke-linejoin="round"/><circle cx="60" cy="118" r="3" fill="${c}"/><circle cx="60" cy="130" r="3" fill="${c}"/>`,
};
let uid = 0;
export function roleArt(role, cls = '') {
  const c = ROLE_COLOR[role] || '#DCE5F5'; const n = ++uid; // معرّفات تدرّج فريدة لكل رسم كي لا تتداخل
  const body = (BUST(c) + (EXTRA[role] || EXTRA.citizen)(c)).replaceAll('"gb"', `"gb${n}"`).replaceAll('url(#gb)', `url(#gb${n})`).replaceAll('"gl"', `"gl${n}"`).replaceAll('url(#gl)', `url(#gl${n})`);
  return raw(`<svg class="${cls}" viewBox="0 0 120 140" aria-hidden="true">${body}</svg>`);
}
export const logoArt = () => raw(`<svg viewBox="0 0 160 160" aria-hidden="true"><defs><radialGradient id="lg" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#D9233C" stop-opacity=".6"/><stop offset="1" stop-color="#D9233C" stop-opacity="0"/></radialGradient></defs>
<circle cx="80" cy="80" r="76" fill="url(#lg)"/><path d="M20 128c0-38 26-62 60-62s60 24 60 62z" fill="#0b1020" stroke="#DCE5F5" stroke-opacity=".5" stroke-width="2.5"/>
<path d="M32 68h96l-12-16c-10-13-22-19-36-19s-26 6-36 19z" fill="#D9233C"/><rect x="26" y="64" width="108" height="11" rx="5.5" fill="#9d1228"/><circle cx="80" cy="102" r="20" fill="#DCE5F5"/><path d="M66 120h28l-14 22z" fill="#E8AE42"/></svg>`);
