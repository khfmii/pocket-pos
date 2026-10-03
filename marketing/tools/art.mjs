// Original flat-vector "product photos" for the demo ACG shop (no third-party characters or brands).
const S = '#26304a'; // outline ink
const defs = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">${inner}</svg>`;
const shadow = (cx = 160, cy = 284, rx = 84, ry = 13) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1b2438" opacity=".22"/>`;
const ink = `stroke="${S}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

export const ART = {
  mecha: wrap(`${defs('b', '#d6ecff', '#8fc3ff')}<rect width="320" height="320" fill="url(#b)"/>
    <circle cx="256" cy="64" r="34" fill="#fff" opacity=".55"/><circle cx="62" cy="96" r="18" fill="#fff" opacity=".45"/>
    ${shadow(160, 286, 96, 14)}<ellipse cx="160" cy="278" rx="92" ry="15" fill="#35466e" ${ink}/>
    <rect x="116" y="196" width="34" height="72" rx="9" fill="#f6f8fd" ${ink}/><rect x="170" y="196" width="34" height="72" rx="9" fill="#f6f8fd" ${ink}/>
    <rect x="108" y="254" width="48" height="20" rx="7" fill="#e5392f" ${ink}/><rect x="164" y="254" width="48" height="20" rx="7" fill="#e5392f" ${ink}/>
    <rect x="124" y="214" width="18" height="10" rx="3" fill="#ffd23f"/><rect x="178" y="214" width="18" height="10" rx="3" fill="#ffd23f"/>
    <path d="M108 118 h104 l-10 84 h-84 z" fill="#f6f8fd" ${ink}/><path d="M126 128 h68 l-6 42 h-56 z" fill="#e5392f" ${ink}/>
    <circle cx="160" cy="150" r="12" fill="#5be3ff" ${ink}/><circle cx="156" cy="146" r="3.5" fill="#fff"/>
    <rect x="124" y="180" width="72" height="12" rx="4" fill="#26304a" opacity=".85"/>
    <rect x="62" y="112" width="42" height="38" rx="10" fill="#e5392f" ${ink}/><rect x="216" y="112" width="42" height="38" rx="10" fill="#e5392f" ${ink}/>
    <rect x="70" y="150" width="28" height="66" rx="9" fill="#f6f8fd" ${ink}/><rect x="222" y="150" width="28" height="66" rx="9" fill="#f6f8fd" ${ink}/>
    <circle cx="84" cy="226" r="12" fill="#35466e" ${ink}/><circle cx="236" cy="226" r="12" fill="#35466e" ${ink}/>
    <path d="M160 74 L128 34 L146 76 z" fill="#ffd23f" ${ink}/><path d="M160 74 L192 34 L174 76 z" fill="#ffd23f" ${ink}/>
    <rect x="130" y="62" width="60" height="54" rx="14" fill="#f6f8fd" ${ink}/><rect x="138" y="82" width="44" height="16" rx="7" fill="#5be3ff" ${ink}/>
    <rect x="144" y="104" width="32" height="6" rx="3" fill="#26304a" opacity=".7"/><circle cx="160" cy="70" r="4" fill="#e5392f"/>`),

  manga: wrap(`${defs('b', '#ffe3ef', '#ffc2d9')}<rect width="320" height="320" fill="url(#b)"/>
    <circle cx="60" cy="70" r="30" fill="#fff" opacity=".5"/><circle cx="270" cy="250" r="40" fill="#fff" opacity=".4"/>
    ${shadow(164, 292, 84, 12)}
    <g transform="rotate(-6 160 160)">
      <rect x="78" y="34" width="168" height="244" rx="8" fill="#f8f3e8" ${ink}/>
      <rect x="86" y="42" width="152" height="228" rx="4" fill="#1f2a5a"/>
      <clipPath id="cv"><rect x="86" y="42" width="152" height="228" rx="4"/></clipPath><g clip-path="url(#cv)"><g transform="translate(162 156)">
        ${Array.from({ length: 24 }, (_, i) => `<path d="M0 0 L${Math.cos(i * Math.PI / 12 - .13) * 170} ${Math.sin(i * Math.PI / 12 - .13) * 170} L${Math.cos(i * Math.PI / 12 + .13) * 170} ${Math.sin(i * Math.PI / 12 + .13) * 170} z" fill="${i % 2 ? '#ff6b8a' : '#ffb347'}"/>`).join('')}
      </g></g>
      <rect x="86" y="42" width="152" height="228" rx="4" fill="none" stroke="#1f2a5a" stroke-width="6"/>
      <path d="M162 70 l12 34 36 2 -28 22 10 36 -30 -20 -30 20 10 -36 -28 -22 36 -2 z" fill="#fff4b8" ${ink}/>
      <rect x="96" y="214" width="132" height="46" rx="6" fill="#fff" ${ink}/>
      <text x="162" y="238" text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif" font-weight="900" font-size="19" fill="#d6245a">STARLIGHT</text>
      <text x="162" y="255" text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif" font-weight="900" font-size="15" fill="#1f2a5a">BLADE · VOL.3</text>
      <rect x="78" y="34" width="14" height="244" rx="6" fill="#e8dfc9" ${ink}/>
    </g>`),

  cards: wrap(`${defs('b', '#e9dcff', '#b79cff')}<rect width="320" height="320" fill="url(#b)"/>
    <defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a5cff"/><stop offset=".35" stop-color="#37d6ff"/><stop offset=".65" stop-color="#ff7ad9"/><stop offset="1" stop-color="#ffd86b"/></linearGradient></defs>
    <circle cx="258" cy="70" r="26" fill="#fff" opacity=".5"/>
    ${shadow(166, 294, 70, 11)}
    <g transform="rotate(14 200 160)"><rect x="170" y="66" width="104" height="146" rx="10" fill="#fff" ${ink}/><rect x="180" y="76" width="84" height="76" rx="6" fill="#ffe27a" ${ink}/><path d="M222 90 l9 20 22 2 -17 14 6 21 -20 -12 -20 12 6 -21 -17 -14 22 -2 z" fill="#ff6b8a" ${ink}/><rect x="182" y="164" width="60" height="8" rx="4" fill="#26304a" opacity=".6"/><rect x="182" y="180" width="80" height="6" rx="3" fill="#26304a" opacity=".3"/></g>
    <path d="M68 62 l12 -10 12 10 12 -10 12 10 12 -10 12 10 12 -10 12 10 12 -10 12 10 v8 h-120 z" fill="#c8b8ff" ${ink}/>
    <rect x="68" y="68" width="120" height="206" fill="url(#f)" ${ink}/>
    <path d="M68 274 l12 10 12 -10 12 10 12 -10 12 10 12 -10 12 10 12 -10 12 10 12 -10 v-8 h-120 z" fill="#c8b8ff" ${ink}/>
    <path d="M90 98 L100 78 L110 98 z M150 190 L160 170 L170 190 z" fill="#fff" opacity=".7"/>
    <circle cx="128" cy="146" r="40" fill="#fff" opacity=".85" ${ink}/><path d="M128 120 l9 18 20 3 -14 14 4 20 -19 -10 -19 10 4 -20 -14 -14 20 -3 z" fill="#ffcf3a" ${ink}/>
    <text x="128" y="224" text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif" font-weight="900" font-size="22" fill="#fff" stroke="#26304a" stroke-width="5" paint-order="stroke">BOOSTER</text>
    <text x="128" y="246" text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif" font-weight="900" font-size="13" fill="#26304a">10 CARDS</text>`),

  pin: wrap(`${defs('b', '#d9fff0', '#9ae8c9')}<rect width="320" height="320" fill="url(#b)"/>
    <circle cx="60" cy="250" r="30" fill="#fff" opacity=".5"/><circle cx="268" cy="60" r="22" fill="#fff" opacity=".5"/>
    ${shadow(160, 288, 78, 11)}
    <rect x="62" y="40" width="196" height="240" rx="16" fill="#fff" ${ink}/><circle cx="160" cy="60" r="8" fill="#9ae8c9" ${ink}/>
    <path d="M160 100 L183 150 L238 154 L197 190 L209 242 L160 214 L111 242 L123 190 L82 154 L137 150 z" fill="#ff8fb1" stroke="#ffc400" stroke-width="10" stroke-linejoin="round"/>
    <path d="M160 100 L183 150 L238 154 L197 190 L209 242 L160 214 L111 242 L123 190 L82 154 L137 150 z" fill="none" ${ink}/>
    <ellipse cx="140" cy="168" rx="7" ry="9" fill="#26304a"/><ellipse cx="180" cy="168" rx="7" ry="9" fill="#26304a"/><circle cx="142" cy="164" r="2.6" fill="#fff"/><circle cx="182" cy="164" r="2.6" fill="#fff"/>
    <path d="M150 188 q10 10 20 0" fill="none" stroke="#26304a" stroke-width="4" stroke-linecap="round"/><ellipse cx="124" cy="184" rx="9" ry="5" fill="#ff5f8d" opacity=".7"/><ellipse cx="196" cy="184" rx="9" ry="5" fill="#ff5f8d" opacity=".7"/>
    <path d="M122 126 l6 -10 6 10 -6 10 z" fill="#fff" opacity=".9"/>
    <text x="160" y="266" text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif" font-weight="900" font-size="15" fill="#26304a" letter-spacing="2">ENAMEL PIN</text>`),

  gacha: wrap(`${defs('b', '#ffe6cc', '#ffbe85')}<rect width="320" height="320" fill="url(#b)"/>
    <circle cx="62" cy="64" r="26" fill="#fff" opacity=".5"/>
    ${shadow(160, 288, 86, 12)}
    <circle cx="66" cy="258" r="22" fill="#ff7aa5" ${ink}/><circle cx="58" cy="250" r="6" fill="#fff" opacity=".7"/>
    <circle cx="258" cy="262" r="18" fill="#7a5cff" ${ink}/><circle cx="252" cy="256" r="5" fill="#fff" opacity=".7"/>
    <g transform="rotate(-18 160 158)">
      <circle cx="160" cy="158" r="96" fill="#fff6fb" ${ink}/>
      <g transform="translate(160 206)"><rect x="-26" y="-22" width="52" height="44" rx="10" fill="#4aa8ff" ${ink}/><circle cx="-8" cy="-4" r="4" fill="#26304a"/><circle cx="8" cy="-4" r="4" fill="#26304a"/><path d="M-6 8 q6 6 12 0" fill="none" stroke="#26304a" stroke-width="3" stroke-linecap="round"/></g>
      <path d="M64 158 a96 96 0 0 1 192 0 z" fill="#2fd68f" ${ink}/>
      <rect x="62" y="150" width="196" height="16" rx="3" fill="#ffc400" ${ink}/>
      <path d="M96 98 a84 84 0 0 1 56 -44" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity=".8"/>
    </g>`),

  pad: wrap(`${defs('b', '#35a0a8', '#16555e')}<rect width="320" height="320" fill="url(#b)"/>
    <circle cx="260" cy="64" r="30" fill="#fff" opacity=".12"/><circle cx="52" cy="256" r="40" fill="#fff" opacity=".1"/>
    ${shadow(160, 258, 120, 15)}
    <rect x="40" y="108" width="240" height="132" rx="48" fill="#dcdcd8" ${ink}/>
    <path d="M40 190 a48 48 0 0 0 48 50 h144 a48 48 0 0 0 48 -50 z" fill="#b7b8b3" ${ink}/>
    <rect x="62" y="126" width="196" height="76" rx="30" fill="#ececE6" ${ink}/>
    <rect x="94" y="136" width="28" height="64" rx="6" fill="#2b2f3a" ${ink}/><rect x="76" y="154" width="64" height="28" rx="6" fill="#2b2f3a" ${ink}/>
    <circle cx="168" cy="190" r="0" fill="none"/>
    <rect x="144" y="168" width="34" height="11" rx="5.5" fill="#9aa0a6" ${ink}/><rect x="184" y="168" width="34" height="11" rx="5.5" fill="#9aa0a6" ${ink}/>
    <circle cx="226" cy="168" r="0"/>
    <circle cx="224" cy="144" r="13" fill="#ffd23f" ${ink}/><circle cx="196" cy="152" r="0"/>
    <circle cx="238" cy="172" r="13" fill="#e5392f" ${ink}/><circle cx="210" cy="172" r="13" fill="#3a7bff" ${ink}/><circle cx="224" cy="196" r="13" fill="#3ccf6e" ${ink}/>
    <text x="160" y="228" text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif" font-weight="900" font-size="14" fill="#26304a" letter-spacing="3">RETRO PAD</text>`),

  keychain: wrap(`${defs('b', '#fff4c9', '#ffd97a')}<rect width="320" height="320" fill="url(#b)"/>
    <circle cx="256" cy="64" r="28" fill="#fff" opacity=".55"/><circle cx="58" cy="248" r="24" fill="#fff" opacity=".45"/>
    ${shadow(160, 292, 70, 10)}
    <circle cx="160" cy="46" r="26" fill="none" stroke="#9aa3b5" stroke-width="9"/><circle cx="160" cy="46" r="26" fill="none" stroke="#26304a" stroke-width="2" opacity=".5"/>
    <path d="M160 70 v26" stroke="#9aa3b5" stroke-width="7" stroke-linecap="round"/><circle cx="160" cy="82" r="5" fill="#26304a" opacity=".4"/>
    <rect x="118" y="114" width="18.4" height="18.4" fill="#26304a"/><rect x="128" y="114" width="18.4" height="18.4" fill="#26304a"/><rect x="168" y="114" width="18.4" height="18.4" fill="#26304a"/><rect x="178" y="114" width="18.4" height="18.4" fill="#26304a"/><rect x="108" y="124" width="18.4" height="18.4" fill="#26304a"/><rect x="118" y="124" width="18.4" height="18.4" fill="#26304a"/><rect x="128" y="124" width="18.4" height="18.4" fill="#26304a"/><rect x="138" y="124" width="18.4" height="18.4" fill="#26304a"/><rect x="158" y="124" width="18.4" height="18.4" fill="#26304a"/><rect x="168" y="124" width="18.4" height="18.4" fill="#26304a"/><rect x="178" y="124" width="18.4" height="18.4" fill="#26304a"/><rect x="188" y="124" width="18.4" height="18.4" fill="#26304a"/><rect x="98" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="108" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="118" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="128" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="138" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="148" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="158" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="168" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="178" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="188" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="198" y="134" width="18.4" height="18.4" fill="#26304a"/><rect x="98" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="108" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="118" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="128" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="138" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="148" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="158" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="168" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="178" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="188" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="198" y="144" width="18.4" height="18.4" fill="#26304a"/><rect x="98" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="108" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="118" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="128" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="138" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="148" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="158" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="168" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="178" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="188" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="198" y="154" width="18.4" height="18.4" fill="#26304a"/><rect x="108" y="164" width="18.4" height="18.4" fill="#26304a"/><rect x="118" y="164" width="18.4" height="18.4" fill="#26304a"/><rect x="128" y="164" width="18.4" height="18.4" fill="#26304a"/><rect x="138" y="164" width="18.4" height="18.4" fill="#26304a"/><rect x="148" y="164" width="18.4" height="18.4" fill="#26304a"/><rect x="158" y="164" width="18.4" height="18.4" fill="#26304a"/><rect x="168" y="164" width="18.4" height="18.4" fill="#26304a"/><rect x="178" y="164" width="18.4" height="18.4" fill="#26304a"/><rect x="188" y="164" width="18.4" height="18.4" fill="#26304a"/><rect x="118" y="174" width="18.4" height="18.4" fill="#26304a"/><rect x="128" y="174" width="18.4" height="18.4" fill="#26304a"/><rect x="138" y="174" width="18.4" height="18.4" fill="#26304a"/><rect x="148" y="174" width="18.4" height="18.4" fill="#26304a"/><rect x="158" y="174" width="18.4" height="18.4" fill="#26304a"/><rect x="168" y="174" width="18.4" height="18.4" fill="#26304a"/><rect x="178" y="174" width="18.4" height="18.4" fill="#26304a"/><rect x="128" y="184" width="18.4" height="18.4" fill="#26304a"/><rect x="138" y="184" width="18.4" height="18.4" fill="#26304a"/><rect x="148" y="184" width="18.4" height="18.4" fill="#26304a"/><rect x="158" y="184" width="18.4" height="18.4" fill="#26304a"/><rect x="168" y="184" width="18.4" height="18.4" fill="#26304a"/><rect x="138" y="194" width="18.4" height="18.4" fill="#26304a"/><rect x="148" y="194" width="18.4" height="18.4" fill="#26304a"/><rect x="158" y="194" width="18.4" height="18.4" fill="#26304a"/><rect x="148" y="204" width="18.4" height="18.4" fill="#26304a"/>
    <rect x="122" y="118" width="10.4" height="10.4" fill="#ff4d79"/><rect x="132" y="118" width="10.4" height="10.4" fill="#ff4d79"/><rect x="172" y="118" width="10.4" height="10.4" fill="#ff4d79"/><rect x="182" y="118" width="10.4" height="10.4" fill="#ff4d79"/><rect x="112" y="128" width="10.4" height="10.4" fill="#ff4d79"/><rect x="122" y="128" width="10.4" height="10.4" fill="#ff9db8"/><rect x="132" y="128" width="10.4" height="10.4" fill="#ff9db8"/><rect x="142" y="128" width="10.4" height="10.4" fill="#ff4d79"/><rect x="162" y="128" width="10.4" height="10.4" fill="#ff4d79"/><rect x="172" y="128" width="10.4" height="10.4" fill="#ff4d79"/><rect x="182" y="128" width="10.4" height="10.4" fill="#ff4d79"/><rect x="192" y="128" width="10.4" height="10.4" fill="#ff4d79"/><rect x="102" y="138" width="10.4" height="10.4" fill="#ff4d79"/><rect x="112" y="138" width="10.4" height="10.4" fill="#ff9db8"/><rect x="122" y="138" width="10.4" height="10.4" fill="#ff9db8"/><rect x="132" y="138" width="10.4" height="10.4" fill="#ff4d79"/><rect x="142" y="138" width="10.4" height="10.4" fill="#ff4d79"/><rect x="152" y="138" width="10.4" height="10.4" fill="#ff4d79"/><rect x="162" y="138" width="10.4" height="10.4" fill="#ff4d79"/><rect x="172" y="138" width="10.4" height="10.4" fill="#ff4d79"/><rect x="182" y="138" width="10.4" height="10.4" fill="#ff4d79"/><rect x="192" y="138" width="10.4" height="10.4" fill="#ff4d79"/><rect x="202" y="138" width="10.4" height="10.4" fill="#ff4d79"/><rect x="102" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="112" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="122" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="132" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="142" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="152" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="162" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="172" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="182" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="192" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="202" y="148" width="10.4" height="10.4" fill="#ff4d79"/><rect x="102" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="112" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="122" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="132" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="142" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="152" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="162" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="172" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="182" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="192" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="202" y="158" width="10.4" height="10.4" fill="#ff4d79"/><rect x="112" y="168" width="10.4" height="10.4" fill="#ff4d79"/><rect x="122" y="168" width="10.4" height="10.4" fill="#ff4d79"/><rect x="132" y="168" width="10.4" height="10.4" fill="#ff4d79"/><rect x="142" y="168" width="10.4" height="10.4" fill="#ff4d79"/><rect x="152" y="168" width="10.4" height="10.4" fill="#ff4d79"/><rect x="162" y="168" width="10.4" height="10.4" fill="#ff4d79"/><rect x="172" y="168" width="10.4" height="10.4" fill="#ff4d79"/><rect x="182" y="168" width="10.4" height="10.4" fill="#ff4d79"/><rect x="192" y="168" width="10.4" height="10.4" fill="#ff4d79"/><rect x="122" y="178" width="10.4" height="10.4" fill="#ff4d79"/><rect x="132" y="178" width="10.4" height="10.4" fill="#ff4d79"/><rect x="142" y="178" width="10.4" height="10.4" fill="#ff4d79"/><rect x="152" y="178" width="10.4" height="10.4" fill="#ff4d79"/><rect x="162" y="178" width="10.4" height="10.4" fill="#ff4d79"/><rect x="172" y="178" width="10.4" height="10.4" fill="#ff4d79"/><rect x="182" y="178" width="10.4" height="10.4" fill="#ff4d79"/><rect x="132" y="188" width="10.4" height="10.4" fill="#ff4d79"/><rect x="142" y="188" width="10.4" height="10.4" fill="#ff4d79"/><rect x="152" y="188" width="10.4" height="10.4" fill="#ff4d79"/><rect x="162" y="188" width="10.4" height="10.4" fill="#ff4d79"/><rect x="172" y="188" width="10.4" height="10.4" fill="#ff4d79"/><rect x="142" y="198" width="10.4" height="10.4" fill="#ff4d79"/><rect x="152" y="198" width="10.4" height="10.4" fill="#ff4d79"/><rect x="162" y="198" width="10.4" height="10.4" fill="#ff4d79"/><rect x="152" y="208" width="10.4" height="10.4" fill="#ff4d79"/>
  `),

  panda: wrap(`${defs('b', '#e3f7d4', '#aee08c')}<rect width="320" height="320" fill="url(#b)"/>
    <circle cx="258" cy="66" r="26" fill="#fff" opacity=".5"/><circle cx="52" cy="238" r="30" fill="#fff" opacity=".4"/>
    ${shadow(160, 290, 90, 12)}
    <ellipse cx="160" cy="224" rx="70" ry="62" fill="#fff" ${ink}/>
    <ellipse cx="102" cy="226" rx="24" ry="40" transform="rotate(18 102 226)" fill="#2b2f3a" ${ink}/><ellipse cx="218" cy="226" rx="24" ry="40" transform="rotate(-18 218 226)" fill="#2b2f3a" ${ink}/>
    <ellipse cx="126" cy="278" rx="30" ry="18" fill="#2b2f3a" ${ink}/><ellipse cx="194" cy="278" rx="30" ry="18" fill="#2b2f3a" ${ink}/>
    <circle cx="96" cy="76" r="34" fill="#2b2f3a" ${ink}/><circle cx="224" cy="76" r="34" fill="#2b2f3a" ${ink}/><circle cx="98" cy="80" r="14" fill="#ff9fb8"/><circle cx="222" cy="80" r="14" fill="#ff9fb8"/>
    <ellipse cx="160" cy="132" rx="96" ry="82" fill="#fff" ${ink}/>
    <ellipse cx="116" cy="130" rx="26" ry="32" transform="rotate(-24 116 130)" fill="#2b2f3a"/><ellipse cx="204" cy="130" rx="26" ry="32" transform="rotate(24 204 130)" fill="#2b2f3a"/>
    <circle cx="118" cy="126" r="9" fill="#fff"/><circle cx="202" cy="126" r="9" fill="#fff"/><circle cx="120" cy="127" r="5" fill="#26304a"/><circle cx="200" cy="127" r="5" fill="#26304a"/>
    <ellipse cx="160" cy="154" rx="12" ry="8" fill="#2b2f3a"/><path d="M148 168 q12 12 24 0" fill="none" stroke="#2b2f3a" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="92" cy="156" rx="12" ry="7" fill="#ff8fb1" opacity=".75"/><ellipse cx="228" cy="156" rx="12" ry="7" fill="#ff8fb1" opacity=".75"/>
    <path d="M118 194 q42 22 84 0 l-4 14 q-38 18 -76 0 z" fill="#ff5b6e" ${ink}/><circle cx="160" cy="206" r="9" fill="#ffd23f" ${ink}/>`),

  standee: wrap(`${defs('b', '#efe3ff', '#c9b3ff')}<rect width="320" height="320" fill="url(#b)"/>
    <circle cx="256" cy="62" r="28" fill="#fff" opacity=".55"/><circle cx="56" cy="214" r="22" fill="#fff" opacity=".45"/>
    ${shadow(160, 292, 80, 11)}
    <rect x="86" y="262" width="148" height="26" rx="8" fill="#ffffff" fill-opacity=".75" ${ink}/><rect x="120" y="256" width="80" height="14" rx="4" fill="#ffffff" fill-opacity=".9" ${ink}/>
    <path d="M160 24 C86 24 56 82 70 138 C74 160 68 190 74 218 C84 244 116 262 160 262 C204 262 236 244 246 218 C252 190 246 160 250 138 C264 82 234 24 160 24 z" fill="#fff" fill-opacity=".55" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>
    <path d="M70 120 C40 150 52 214 72 236 C80 214 76 160 92 130 z" fill="#38d6c8" ${ink}/><path d="M250 120 C280 150 268 214 248 236 C240 214 244 160 228 130 z" fill="#38d6c8" ${ink}/>
    <path d="M118 214 h84 l10 44 h-104 z" fill="#ff6b9a" ${ink}/><path d="M138 214 l22 26 22 -26 z" fill="#fff" ${ink}/><path d="M160 232 l-12 20 h24 z" fill="#ffd23f" ${ink}/>
    <ellipse cx="160" cy="126" rx="62" ry="68" fill="#ffe2cf" ${ink}/>
    <path d="M96 118 C92 56 130 38 160 38 C190 38 228 56 224 118 C204 100 184 84 160 82 C136 84 116 100 96 118 z" fill="#38d6c8" ${ink}/>
    <path d="M130 84 q10 22 -4 40 M190 84 q-10 22 4 40" fill="none" stroke="#26304a" stroke-width="3" stroke-linecap="round" opacity=".5"/>
    <ellipse cx="136" cy="136" rx="13" ry="17" fill="#26304a"/><ellipse cx="184" cy="136" rx="13" ry="17" fill="#26304a"/>
    <circle cx="140" cy="130" r="5.5" fill="#fff"/><circle cx="188" cy="130" r="5.5" fill="#fff"/><circle cx="132" cy="142" r="2.6" fill="#fff"/><circle cx="180" cy="142" r="2.6" fill="#fff"/>
    <ellipse cx="118" cy="158" rx="10" ry="6" fill="#ff7aa5" opacity=".7"/><ellipse cx="202" cy="158" rx="10" ry="6" fill="#ff7aa5" opacity=".7"/>
    <path d="M150 166 q10 9 20 0" fill="none" stroke="#26304a" stroke-width="4" stroke-linecap="round"/>
    <circle cx="214" cy="70" r="12" fill="#ff6b9a" ${ink}/><circle cx="106" cy="70" r="12" fill="#ff6b9a" ${ink}/>`),
};

// Shop logo: a round panda face on a mint tile (flattened on white by the app anyway).
export function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="320" height="320"><rect width="160" height="160" fill="#fff"/>
  <rect x="8" y="8" width="144" height="144" rx="34" fill="#7be0c0"/>
  <circle cx="44" cy="52" r="20" fill="#232a3b"/><circle cx="116" cy="52" r="20" fill="#232a3b"/>
  <ellipse cx="80" cy="88" rx="52" ry="46" fill="#fff"/>
  <ellipse cx="56" cy="86" rx="14" ry="18" transform="rotate(-24 56 86)" fill="#232a3b"/><ellipse cx="104" cy="86" rx="14" ry="18" transform="rotate(24 104 86)" fill="#232a3b"/>
  <circle cx="58" cy="83" r="5.5" fill="#fff"/><circle cx="102" cy="83" r="5.5" fill="#fff"/>
  <ellipse cx="80" cy="104" rx="8" ry="5.5" fill="#232a3b"/><path d="M72 112 q8 8 16 0" fill="none" stroke="#232a3b" stroke-width="3.5" stroke-linecap="round"/>
  <rect x="30" y="126" width="6" height="6" fill="#ffd23f"/><rect x="124" y="30" width="6" height="6" fill="#ffd23f"/><rect x="36" y="132" width="6" height="6" fill="#ff7aa5"/></svg>`;
}
