// Original flat-vector product art for the café and fashion demo shops (same style as art.mjs).
const S = '#26304a';
const ink = `stroke="${S}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const inkw = (w) => `stroke="${S}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const defs = (a, b) => `<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="320" fill="url(#b)"/><circle cx="262" cy="62" r="28" fill="#fff" opacity=".5"/><circle cx="56" cy="250" r="24" fill="#fff" opacity=".4"/>`;
const sh = (cx = 160, cy = 288, rx = 84, ry = 12) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1b2438" opacity=".2"/>`;
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">${inner}</svg>`;

export const CAFE = {
  latte: wrap(`${defs('#fff0dc', '#ffd6a8')}${sh(160, 290, 100)}
    <ellipse cx="160" cy="262" rx="102" ry="22" fill="#fff" ${ink}/><ellipse cx="160" cy="258" rx="70" ry="12" fill="#e9eef7"/>
    <path d="M214 150 q50 -4 46 38 q-4 36 -50 34" fill="none" stroke="${S}" stroke-width="22" stroke-linecap="round"/><path d="M214 150 q50 -4 46 38 q-4 36 -50 34" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/>
    <path d="M86 116 h148 l-12 118 q-4 28 -30 28 h-64 q-26 0 -30 -28 z" fill="#fff" ${ink}/>
    <ellipse cx="160" cy="116" rx="74" ry="16" fill="#8a5a3c" ${ink}/><ellipse cx="160" cy="116" rx="52" ry="10" fill="#c99a6b"/>
    <path d="M160 122 c-24 -14 -10 -26 0 -14 c10 -12 24 0 0 14 z" fill="#fff4e4" ${inkw(3)}/>
    <path d="M128 84 q-10 -16 0 -30 M160 80 q-10 -18 0 -36 M192 84 q-10 -16 0 -30" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".85"/>`),
  iced: wrap(`${defs('#dff3ff', '#a9d8f5')}${sh(160, 290, 70)}
    <path d="M200 40 L214 14" stroke="#ff6fa8" stroke-width="10" stroke-linecap="round"/>
    <path d="M96 70 h128 l-14 206 q-1 12 -14 12 h-72 q-13 0 -14 -12 z" fill="#ffffff" fill-opacity=".55" ${ink}/>
    <path d="M102 140 h116 l-9 134 q-1 10 -12 10 h-74 q-11 0 -12 -10 z" fill="#7a4a2e"/><path d="M104 112 h112 l-2 28 h-108 z" fill="#f2dcc0"/>
    <rect x="116" y="150" width="40" height="40" rx="8" fill="#fff" fill-opacity=".8" ${ink} transform="rotate(-10 136 170)"/><rect x="168" y="190" width="40" height="40" rx="8" fill="#fff" fill-opacity=".8" ${ink} transform="rotate(12 188 210)"/><rect x="128" y="226" width="36" height="36" rx="8" fill="#fff" fill-opacity=".8" ${ink} transform="rotate(8 146 244)"/>
    <path d="M96 70 h128" ${ink}/><path d="M118 92 v150" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".5"/><path d="M196 24 L168 116" stroke="#ff6fa8" stroke-width="10" stroke-linecap="round"/>`),
  croissant: wrap(`${defs('#ffe9c7', '#ffc98a')}${sh(160, 280, 104, 13)}
    <path d="M40 218 C34 150 84 100 160 100 C236 100 286 150 280 218 C262 196 246 192 232 196 C226 220 196 236 160 236 C124 236 94 220 88 196 C74 192 58 196 40 218 z" fill="#e8a24a" ${ink}/>
    <path d="M110 108 q-8 52 6 118 M160 100 q-4 70 0 136 M210 108 q8 52 -6 118" fill="none" stroke="${S}" stroke-width="4" stroke-linecap="round"/>
    <path d="M70 160 q30 -36 80 -40" fill="none" stroke="#ffd58a" stroke-width="10" stroke-linecap="round" opacity=".8"/>`),
  cheesecake: wrap(`${defs('#ffe3ec', '#ffc0d4')}${sh(160, 282, 108, 13)}
    <ellipse cx="160" cy="262" rx="108" ry="22" fill="#fff" ${ink}/>
    <path d="M70 150 L250 130 L250 224 L70 244 z" fill="#ffe9a8" ${ink}/><path d="M70 150 L250 130 L250 156 L70 176 z" fill="#ffc7d6" ${ink}/><path d="M70 176 L250 156 L250 164 L70 184 z" fill="#c98a5a"/>
    <path d="M70 244 L250 224 L250 232 L70 252 z" fill="#c98a5a" ${ink}/>
    <circle cx="190" cy="112" r="30" fill="#ff4d6d" ${ink}/><path d="M178 84 q12 -16 24 0 q-12 8 -24 0z" fill="#3ccf6e" ${inkw(3)}/><circle cx="180" cy="106" r="3" fill="#ffd0d8"/><circle cx="196" cy="118" r="3" fill="#ffd0d8"/><circle cx="204" cy="102" r="3" fill="#ffd0d8"/>`),
  boba: wrap(`${defs('#f1e4ff', '#d2b6ff')}${sh(160, 290, 66)}
    <path d="M214 30 L190 118" stroke="#3ccf6e" stroke-width="12" stroke-linecap="round"/>
    <path d="M92 96 q68 -34 136 0 l-4 14 h-128 z" fill="#fff" fill-opacity=".8" ${ink}/>
    <path d="M96 108 h128 l-14 168 q-1 12 -14 12 h-72 q-13 0 -14 -12 z" fill="#fff" fill-opacity=".6" ${ink}/>
    <path d="M100 150 h120 l-10 124 q-1 10 -12 10 h-76 q-11 0 -12 -10 z" fill="#c68b59"/>
    ${[[124, 262], [150, 270], [176, 264], [200, 268], [136, 244], [166, 246], [192, 244]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#2b1b17" ${inkw(2)}/>`).join('')}
    <path d="M118 124 v110" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".5"/>`),
  matcha: wrap(`${defs('#e6f9d6', '#b5e48c')}${sh(160, 290, 78)}
    <path d="M214 150 q44 -2 40 34 q-4 30 -44 28" fill="none" stroke="${S}" stroke-width="20" stroke-linecap="round"/><path d="M214 150 q44 -2 40 34 q-4 30 -44 28" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/>
    <path d="M88 108 h132 l-12 142 q-3 28 -28 28 h-52 q-25 0 -28 -28 z" fill="#fff" ${ink}/>
    <ellipse cx="154" cy="108" rx="66" ry="14" fill="#7cb342" ${ink}/><ellipse cx="154" cy="108" rx="46" ry="8" fill="#a5d667"/>
    <path d="M134 108 q20 -8 40 0" fill="none" stroke="#e8f5d0" stroke-width="5" stroke-linecap="round"/>
    <path d="M110 140 q8 60 4 100" fill="none" stroke="#e8eef7" stroke-width="10" stroke-linecap="round"/>`),
  muffin: wrap(`${defs('#e5ecff', '#bccdff')}${sh(160, 288, 78)}
    <path d="M98 168 h124 l-14 104 q-2 14 -16 14 h-64 q-14 0 -16 -14 z" fill="#f4b183" ${ink}/>
    <path d="M118 172 l8 108 M142 172 l4 112 M178 172 l-4 112 M202 172 l-8 108" stroke="${S}" stroke-width="3" opacity=".5"/>
    <path d="M76 176 C60 100 110 56 160 56 C210 56 260 100 244 176 C220 164 100 164 76 176 z" fill="#d9a066" ${ink}/>
    ${[[120, 100], [168, 84], [204, 118], [146, 134], [100, 140], [188, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#5b4bd6" ${inkw(3)}/><circle cx="${x - 3}" cy="${y - 3}" r="2.5" fill="#c7c0ff"/>`).join('')}`),
  sandwich: wrap(`${defs('#fff6d6', '#ffe08a')}${sh(160, 284, 104, 13)}
    <path d="M44 250 L160 70 L276 250 z" fill="#f6dba4" ${ink}/>
    <path d="M62 236 L160 84 L258 236 z" fill="#8fd16a" ${inkw(3)}/>
    <path d="M78 222 L160 98 L242 222 z" fill="#ff7a6b" ${inkw(3)}/>
    <path d="M94 208 L160 112 L226 208 z" fill="#ffe7a6" ${inkw(3)}/>
    <path d="M44 250 L276 250 L270 274 L50 274 z" fill="#f2c883" ${ink}/>
    <circle cx="160" cy="26" r="0"/>`),
  cookie: wrap(`${defs('#ffe9d9', '#ffc9a3')}${sh(160, 284, 92, 12)}
    <circle cx="160" cy="166" r="104" fill="#d9a05f" ${ink}/><circle cx="160" cy="166" r="92" fill="none" stroke="#e8bd84" stroke-width="6" stroke-dasharray="3 14" stroke-linecap="round"/>
    ${[[120, 120], [190, 108], [216, 170], [150, 160], [104, 190], [186, 220], [146, 232], [226, 124]].map(([x, y], i) => `<path d="M${x - 14} ${y} q4 -16 22 -12 q10 10 0 22 q-14 8 -22 -10z" fill="#4b2e22" ${inkw(3)} transform="rotate(${i * 40} ${x} ${y})"/>`).join('')}`),
};

export const FASHION = {
  tee: wrap(`${defs('#dff0ff', '#a8d2ff')}${sh(160, 290, 96)}
    <path d="M110 52 q50 30 100 0 L282 96 L250 150 L222 132 V270 q0 14 -14 14 H112 q-14 0 -14 -14 V132 L70 150 L38 96 z" fill="#ffd166" ${ink}/>
    <path d="M110 52 q50 38 100 0" fill="none" ${ink}/><path d="M100 132 L98 270" stroke="#ffb703" stroke-width="3" opacity=".0"/>
    <rect x="132" y="168" width="56" height="56" rx="10" fill="#fff" opacity=".9" ${ink}/><path d="M160 180 l8 16 18 3 -13 12 3 18 -16 -9 -16 9 3 -18 -13 -12 18 -3 z" fill="#ff6fa8" ${inkw(3)}/>`),
  jeans: wrap(`${defs('#efe6ff', '#cdb8ff')}${sh(160, 292, 82)}
    <path d="M96 34 h128 l24 232 q1 14 -13 14 h-46 l-17 -150 -17 150 H85 q-14 0 -13 -14 z" fill="#4f7cc4" ${ink}/>
    <path d="M96 34 h128 v26 H96 z" fill="#3f68a8" ${ink}/><path d="M160 60 v76" stroke="${S}" stroke-width="4"/>
    <rect x="104" y="40" width="10" height="14" rx="2" fill="#26304a" opacity=".5"/><rect x="206" y="40" width="10" height="14" rx="2" fill="#26304a" opacity=".5"/>
    <path d="M110 80 q18 6 30 -4 M210 80 q-18 6 -30 -4" fill="none" stroke="#ffd166" stroke-width="3" stroke-dasharray="6 5"/>
    <circle cx="160" cy="68" r="5" fill="#ffd166" ${inkw(2)}/><path d="M100 232 h46 M174 232 h46" stroke="#ffd166" stroke-width="3" stroke-dasharray="6 5" opacity=".9"/>`),
  dress: wrap(`${defs('#ffe3ee', '#ffb8d0')}${sh(160, 292, 98)}
    <path d="M126 28 q34 28 68 0 l10 56 q-12 12 -2 36 L270 268 q4 14 -10 14 H60 q-14 0 -10 -14 L118 120 q10 -24 -2 -36 z" fill="#ff6fa8" ${ink}/>
    <path d="M118 120 q42 22 84 0" fill="none" ${ink}/><path d="M126 28 l-6 56 M194 28 l6 56" fill="none" ${inkw(3)}/>
    ${[[110, 200], [160, 176], [214, 214], [140, 244], [190, 252], [90, 252], [236, 256]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#fff" opacity=".85"/>`).join('')}
    <path d="M140 118 q20 10 40 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>`),
  cap: wrap(`${defs('#e0f7ee', '#9be8c9')}${sh(160, 280, 104, 13)}
    <path d="M60 196 C54 100 100 62 160 62 C220 62 266 100 260 196 z" fill="#e5392f" ${ink}/>
    <path d="M160 62 v134 M110 78 q-18 60 -10 118 M210 78 q18 60 10 118" fill="none" stroke="${S}" stroke-width="3" opacity=".6"/>
    <path d="M52 196 H262 q40 0 50 28 q-70 -14 -262 -4 z" fill="#c42d25" ${ink}/><circle cx="160" cy="60" r="8" fill="#c42d25" ${ink}/>
    <rect x="132" y="116" width="56" height="36" rx="8" fill="#fff" ${ink}/><path d="M144 144 v-20 l16 12 16 -12 v20" fill="none" stroke="#e5392f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  sneaker: wrap(`${defs('#fff1c9', '#ffd77a')}${sh(160, 270, 118, 13)}
    <path d="M40 232 V142 q0 -14 14 -14 h34 q18 40 62 54 l62 14 q54 12 68 40 V232 z" fill="#ffffff" ${ink}/>
    <path d="M40 232 h260 v24 q0 12 -12 12 H52 q-12 0 -12 -12 z" fill="#ff6fa8" ${ink}/><path d="M40 232 h260" stroke="${S}" stroke-width="4"/>
    <path d="M150 190 l-16 -22 M170 196 l-16 -22 M190 200 l-14 -22" stroke="${S}" stroke-width="5" stroke-linecap="round"/>
    <path d="M54 128 h30 l8 20 H54 z" fill="#4f7cc4" ${inkw(3)}/><path d="M230 214 q30 4 52 22" fill="none" stroke="#4f7cc4" stroke-width="10" stroke-linecap="round"/>`),
  tote: wrap(`${defs('#e7f3ff', '#b4d4ff')}${sh(160, 290, 88)}
    <path d="M110 120 C110 40 210 40 210 120" fill="none" stroke="${S}" stroke-width="20" stroke-linecap="round"/><path d="M110 120 C110 44 210 44 210 120" fill="none" stroke="#f2c879" stroke-width="12" stroke-linecap="round"/>
    <path d="M64 110 h192 l16 160 q1 14 -13 14 H61 q-14 0 -13 -14 z" fill="#f2e2c0" ${ink}/>
    <path d="M160 160 q-30 -24 -50 -4 q-10 22 50 54 q60 -32 50 -54 q-20 -20 -50 4 z" fill="#ff6b8a" ${ink}/>
    <path d="M64 130 h192" stroke="${S}" stroke-width="3" opacity=".35"/>`),
  scarf: wrap(`${defs('#ffefe0', '#ffc9a0')}${sh(160, 292, 92)}
    <path d="M118 96 L156 104 L146 262 L100 252 z" fill="#e5392f" ${ink}/>
    <path d="M166 104 L216 92 L232 236 L182 250 z" fill="#c42d25" ${ink}/>
    <path d="M112 158 L150 166 M108 190 L148 198 M104 222 L146 230" stroke="#ffd166" stroke-width="12" stroke-linecap="butt"/>
    <path d="M176 150 L224 140 M180 182 L228 174 M184 214 L230 206" stroke="#ffd166" stroke-width="12" stroke-linecap="butt"/>
    <path d="M100 252 L146 262 M182 250 L232 236" stroke="${S}" stroke-width="4"/>
    <path d="M102 258 l-2 16 M112 260 l-2 16 M122 262 l-2 16 M132 264 l-2 16 M142 266 l-2 14 M184 254 l0 16 M196 252 l0 16 M208 249 l0 16 M220 246 l0 16 M230 243 l1 14" stroke="#e5392f" stroke-width="5" stroke-linecap="round"/>
    <path d="M62 78 C62 40 258 40 258 78 C258 118 204 126 160 126 C116 126 62 118 62 78 z" fill="#ff5b4d" ${ink}/>
    <path d="M86 70 C120 92 200 92 234 70" fill="none" stroke="#ffd166" stroke-width="10" stroke-linecap="round"/>
    <path d="M90 92 q70 24 140 0" fill="none" stroke="#c42d25" stroke-width="4" stroke-linecap="round" opacity=".5"/>`),
  shades: wrap(`${defs('#fff6c9', '#ffe27a')}${sh(160, 250, 100, 11)}
    <path d="M56 130 H264" stroke="${S}" stroke-width="12" stroke-linecap="round"/>
    <path d="M56 130 L44 108 M264 130 L276 108" stroke="${S}" stroke-width="10" stroke-linecap="round"/>
    <path d="M58 124 h96 v22 q0 56 -48 56 q-48 0 -48 -56 z" fill="#26304a" ${ink}/><path d="M166 124 h96 v22 q0 56 -48 56 q-48 0 -48 -56 z" fill="#26304a" ${ink}/>
    <path d="M72 138 q8 -6 24 -4 M180 138 q8 -6 24 -4" stroke="#7fd6ff" stroke-width="7" stroke-linecap="round" opacity=".9"/>
    <path d="M154 130 q6 -10 12 0" fill="none" ${ink}/>`),
  socks: wrap(`${defs('#e8e0ff', '#c2b0ff')}${sh(160, 290, 96)}
    <g transform="rotate(-8 110 160)"><path d="M70 40 h62 v118 q0 22 -14 36 l-40 38 q-18 16 -44 -4 q-14 -22 6 -40 l30 -26 z" fill="#4ad0b8" ${ink}/><rect x="70" y="40" width="62" height="24" fill="#fff" ${ink}/><path d="M72 84 h58 M72 104 h58" stroke="#ffd166" stroke-width="9"/><path d="M60 224 q14 -14 40 -12" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".8" fill="none"/></g>
    <g transform="rotate(8 220 170)"><path d="M190 52 h62 v110 q0 22 -14 36 l-40 38 q-18 16 -44 -4 q-14 -22 6 -40 l30 -26 z" fill="#ff8fb1" ${ink}/><rect x="190" y="52" width="62" height="24" fill="#fff" ${ink}/><path d="M192 96 h58 M192 116 h58" stroke="#fff" stroke-width="9"/></g>`),
};

export const LOGO_CAFE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="320" height="320"><rect width="160" height="160" fill="#fff"/><rect x="8" y="8" width="144" height="144" rx="34" fill="#c68b59"/>
  <path d="M42 70 h70 l-6 46 q-2 12 -14 12 h-30 q-12 0 -14 -12 z" fill="#fff"/><path d="M112 80 q26 -2 24 18 q-2 18 -28 16" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
  <path d="M60 58 q-8 -12 0 -22 M78 54 q-8 -14 0 -28 M96 58 q-8 -12 0 -22" fill="none" stroke="#ffe9c7" stroke-width="7" stroke-linecap="round"/><ellipse cx="78" cy="72" rx="35" ry="7" fill="#7a4a2e"/></svg>`;
export const LOGO_FASHION = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="320" height="320"><rect width="160" height="160" fill="#fff"/><rect x="8" y="8" width="144" height="144" rx="34" fill="#ff8fb1"/>
  <path d="M80 50 c0 -16 22 -16 22 0 c0 8 -10 10 -22 22 L28 112 q-10 10 4 14 h96 q14 -4 4 -14 L80 72" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="80" cy="132" r="0"/></svg>`;
