import React, { useState, useEffect, useMemo } from 'react';
import {
  Home, Users, Calendar, Wallet, User, Shield, Plus, X, Check,
  ChevronLeft, ChevronRight, Search, Trash2, Pencil, Phone,
  CheckCircle2, Circle, Trophy, Lock, QrCode, Copy, LogOut
} from 'lucide-react';

/* ---------------------------------------------------------
   TOKENS
--------------------------------------------------------- */
const C = {
  bg: '#071A12',
  bgGrad: 'radial-gradient(1100px 700px at 50% -12%, #0F2E20 0%, #071A12 55%, #050F0B 100%)',
  card: '#0D2318',
  cardAlt: '#11291C',
  line: 'rgba(245,241,230,0.09)',
  chalk: '#F5F1E6',
  chalkDim: '#8FA69A',
  gold: '#FFC53D',
  goldDim: '#B98A2A',
  green: '#17E88F',
  greenDim: '#0FA868',
  vascoBlack: '#0E0E10',
  vascoWhite: '#F5F3EE',
  flaRed: '#E2231A',
  flaBlack: '#141414',
  danger: '#E5484D',
  success: '#33C481',
};

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');";

const POSITIONS = [
  { key: 'Goleiro', abbr: 'GOL' },
  { key: 'Zagueiro', abbr: 'ZAG' },
  { key: 'Lateral', abbr: 'LAT' },
  { key: 'Volante', abbr: 'VOL' },
  { key: 'Meia', abbr: 'MEI' },
  { key: 'Atacante', abbr: 'ATA' },
];

const TEAM_STYLE = {
  Vasco: {
    label: 'Vasco',
    bg: 'linear-gradient(135deg, #0E0E10 46%, #F5F3EE 46%, #F5F3EE 54%, #0E0E10 54%)',
    solid: C.vascoBlack,
    text: C.vascoWhite,
    dot: '#F5F3EE',
    chip: 'rgba(245,243,238,0.12)',
  },
  Flamengo: {
    label: 'Flamengo',
    bg: 'repeating-linear-gradient(0deg, #E2231A 0px, #E2231A 9px, #141414 9px, #141414 18px)',
    solid: C.flaRed,
    text: '#FFFFFF',
    dot: '#E2231A',
    chip: 'rgba(226,35,26,0.18)',
  },
};

const DEFAULT_DATA = { players: [], attendance: {}, payments: {}, config: { monthlyFee: 70, adminPin: null } };
const STORAGE_KEY = 'furao-app-data';

/* ---------------------------------------------------------
   EMBLEMAS ORIGINAIS (desenho próprio, não são os escudos
   oficiais dos clubes — apenas inspirados nas cores de cada time)
--------------------------------------------------------- */
const SHIELD_PATH = 'M50,4 L91,17 L91,52 C91,83 73,102 50,113 C27,102 9,83 9,52 L9,17 Z';

function StarMark({ fill }) {
  return <polygon points="50,15 53,23 62,23 55,28.5 57.5,37 50,32 42.5,37 45,28.5 38,23 47,23" fill={fill} />;
}

function VascoEmblem({ size = 40 }) {
  return (
    <svg width={size} height={size * 1.13} viewBox="0 0 100 113" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="vascoShieldClip"><path d={SHIELD_PATH} /></clipPath>
      </defs>
      <g clipPath="url(#vascoShieldClip)">
        <rect width="100" height="113" fill="#0E0E10" />
        <path d="M-10,48 L66,-8 L88,3 L12,62 Z" fill="#F5F3EE" />
      </g>
      <path d={SHIELD_PATH} fill="none" stroke="#FFC53D" strokeWidth="3.5" />
      <StarMark fill="#FFC53D" />
      <text x="50" y="90" fontFamily="'Rajdhani',sans-serif" fontWeight="700" fontSize="36" fill="#FFC53D" textAnchor="middle">V</text>
    </svg>
  );
}

function FlamengoEmblem({ size = 40 }) {
  return (
    <svg width={size} height={size * 1.13} viewBox="0 0 100 113" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="flaShieldClip"><path d={SHIELD_PATH} /></clipPath>
      </defs>
      <g clipPath="url(#flaShieldClip)">
        <rect width="100" height="56" fill="#141414" />
        <rect y="56" width="100" height="57" fill="#E2231A" />
      </g>
      <path d={SHIELD_PATH} fill="none" stroke="#FFC53D" strokeWidth="3.5" />
      <StarMark fill="#FFC53D" />
      <text x="50" y="90" fontFamily="'Rajdhani',sans-serif" fontWeight="700" fontSize="36" fill="#FFFFFF" textAnchor="middle">F</text>
    </svg>
  );
}

const TEAM_EMBLEM = { Vasco: VascoEmblem, Flamengo: FlamengoEmblem };
const PIX_KEY_RAW = '21999983445';

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
function fmtBRL(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function pad(n) { return String(n).padStart(2, '0'); }

function getNextMatch() {
  const d = new Date();
  const day = d.getDay();
  let diff = (3 - day + 7) % 7;
  d.setDate(d.getDate() + diff);
  d.setHours(20, 0, 0, 0);
  return d;
}
function matchKeyFor(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function monthKeyFor(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function hashPassword(password, salt) {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${password}`);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let h = 0;
    const s = `${salt}:${password}`;
    for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return 'fb' + Math.abs(h).toString(16);
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (e2) { return false; }
  }
}

/* ---------------------------------------------------------
   PIX (BR Code / EMV) PAYLOAD BUILDER
--------------------------------------------------------- */
function tlv(id, value) { return id + String(value.length).padStart(2, '0') + value; }

function crc16ccitt(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPixPayload({ amount, description, txid }) {
  const key = `+55${PIX_KEY_RAW}`;
  let mai = tlv('00', 'br.gov.bcb.pix') + tlv('01', key);
  if (description) mai += tlv('02', description.slice(0, 40));
  const merchantAccount = tlv('26', mai);

  let payload = tlv('00', '01') + tlv('01', '11') + merchantAccount + tlv('52', '0000') + tlv('53', '986');
  if (amount && Number(amount) > 0) payload += tlv('54', Number(amount).toFixed(2));
  payload += tlv('58', 'BR') + tlv('59', 'SUPER CLASSICO'.slice(0, 25)) + tlv('60', 'RIO DE JANEIRO'.slice(0, 15));

  const cleanTxid = (txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  payload += tlv('62', tlv('05', cleanTxid));
  payload += '6304';
  return payload + crc16ccitt(payload);
}

/* ---------------------------------------------------------
   GENERIC MODAL
--------------------------------------------------------- */
function Modal({ title, onClose, children, wide }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4,14,10,0.72)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50,
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: wide ? 460 : 420, background: C.card,
          borderTop: `1px solid ${C.line}`, borderLeft: `1px solid ${C.line}`, borderRight: `1px solid ${C.line}`,
          borderRadius: '20px 20px 0 0', maxHeight: '88vh', overflowY: 'auto',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{
          position: 'sticky', top: 0, background: C.card, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px', borderBottom: `1px solid ${C.line}`,
        }}>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: 0.3, color: C.chalk }}>{title}</span>
          <button onClick={onClose} style={{ background: 'rgba(245,241,230,0.08)', border: 'none', borderRadius: 999, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} color={C.chalk} />
          </button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, danger, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '13px 16px', borderRadius: 10, border: 'none',
        background: disabled ? 'rgba(245,241,230,0.12)' : danger ? C.danger : C.green,
        color: disabled ? C.chalkDim : danger ? '#fff' : '#052015',
        fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 0.4,
        cursor: disabled ? 'not-allowed' : 'pointer', ...style,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.chalkDim, marginBottom: 6, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(245,241,230,0.06)',
  border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 12px',
  color: C.chalk, fontSize: 15, fontFamily: "'Inter',sans-serif", outline: 'none',
};

/* ---------------------------------------------------------
   PLAYER FORM (create / edit) — inclui usuário e senha
--------------------------------------------------------- */
function PlayerForm({ initial, onCancel, onSave, hasAdmin, players }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [team, setTeam] = useState(initial?.team || 'Vasco');
  const [position, setPosition] = useState(initial?.position || 'Meia');
  const [username, setUsername] = useState(initial?.username || '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [wantsAdmin, setWantsAdmin] = useState(initial?.isAdmin || false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const editingAdminAlready = initial?.isAdmin;

  async function submit() {
    if (!name.trim()) { setError('Digite o nome do jogador.'); return; }
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUsername) { setError('Escolha um nome de usuário.'); return; }
    const taken = players.some((p) => p.username?.toLowerCase() === cleanUsername);
    if (taken) { setError('Esse usuário já está em uso. Escolha outro.'); return; }

    if (!isEdit && password.length < 4) { setError('Crie uma senha com pelo menos 4 caracteres.'); return; }
    if (!isEdit && password !== passwordConfirm) { setError('As senhas não conferem.'); return; }
    if (isEdit && password && password !== passwordConfirm) { setError('As senhas não conferem.'); return; }
    if (isEdit && password && password.length < 4) { setError('A nova senha precisa ter ao menos 4 caracteres.'); return; }

    let isAdmin = editingAdminAlready ? true : false;
    let newPin = null;

    if (wantsAdmin && !editingAdminAlready) {
      if (!hasAdmin) {
        if (pin.length < 4) { setError('Crie um PIN de administrador com pelo menos 4 dígitos.'); return; }
        if (pin !== pinConfirm) { setError('Os PINs não conferem.'); return; }
        newPin = pin;
        isAdmin = true;
      } else {
        if (pin.length < 4) { setError('Digite o PIN de administrador existente.'); return; }
        isAdmin = 'needs-verify';
      }
    }

    setError('');
    setSaving(true);
    let passwordHash = initial?.passwordHash;
    let salt = initial?.salt;
    if (!isEdit || password) {
      salt = uid();
      passwordHash = await hashPassword(password, salt);
    }
    setSaving(false);
    onSave({
      name: name.trim(), phone: phone.trim(), team, position,
      username: cleanUsername, passwordHash, salt,
      isAdmin, wantsAdminPin: pin, newPin,
    });
  }

  return (
    <div>
      <Field label="Nome do jogador">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva" />
      </Field>
      <Field label="Telefone (opcional)">
        <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(21) 9xxxx-xxxx" />
      </Field>
      <Field label="Time">
        <div style={{ display: 'flex', gap: 10 }}>
          {['Vasco', 'Flamengo'].map((t) => {
            const Emblem = TEAM_EMBLEM[t];
            return (
              <button
                key={t}
                onClick={() => setTeam(t)}
                style={{
                  flex: 1, padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                  border: team === t ? `2px solid ${C.green}` : `1px solid ${C.line}`,
                  background: C.cardAlt, color: C.chalk,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                <Emblem size={30} />
                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14 }}>{t}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Posição (cargo em campo)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {POSITIONS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPosition(p.key)}
              style={{
                padding: '9px 6px', borderRadius: 10, cursor: 'pointer',
                border: position === p.key ? `2px solid ${C.gold}` : `1px solid ${C.line}`,
                background: position === p.key ? 'rgba(255,197,61,0.12)' : 'rgba(245,241,230,0.04)',
                color: C.chalk, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13,
              }}
            >
              {p.key}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 10 }}>
          Acesso pessoal
        </div>
        <Field label="Usuário (login)">
          <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: joaosilva" autoCapitalize="none" />
        </Field>
        <Field label={isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha'}>
          <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 4 caracteres" />
        </Field>
        {(password || !isEdit) && (
          <Field label="Confirmar senha">
            <input style={inputStyle} type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Repita a senha" />
          </Field>
        )}
      </div>

      {!editingAdminAlready && (
        <Field label="Cargo administrativo">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 12, background: 'rgba(245,241,230,0.04)' }}>
            <input type="checkbox" checked={wantsAdmin} onChange={(e) => setWantsAdmin(e.target.checked)} />
            <Shield size={16} color={C.gold} />
            <span style={{ fontSize: 14, color: C.chalk }}>Também é administrador (cuida das finanças)</span>
          </label>
          {wantsAdmin && (
            <div style={{ marginTop: 10 }}>
              {!hasAdmin ? (
                <>
                  <div style={{ fontSize: 12, color: C.chalkDim, marginBottom: 6 }}>Você será o primeiro administrador. Crie um PIN para proteger o financeiro:</div>
                  <input style={{ ...inputStyle, marginBottom: 8 }} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Criar PIN (mín. 4 dígitos)" />
                  <input style={inputStyle} type="password" inputMode="numeric" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value)} placeholder="Confirmar PIN" />
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: C.chalkDim, marginBottom: 6 }}>Digite o PIN de administrador já existente para assumir este cargo:</div>
                  <input style={inputStyle} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN de administrador" />
                </>
              )}
            </div>
          )}
        </Field>
      )}

      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <PrimaryButton onClick={submit} disabled={saving}>{initial ? 'Salvar alterações' : 'Cadastrar jogador'}</PrimaryButton>
      </div>
    </div>
  );
}

function PinPrompt({ onConfirm, label }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return (
    <div>
      <div style={{ fontSize: 14, color: C.chalkDim, marginBottom: 12 }}>{label || 'Digite o PIN de administrador para continuar.'}</div>
      <input style={{ ...inputStyle, marginBottom: 10 }} type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" />
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <PrimaryButton onClick={() => (pin ? onConfirm(pin, setError) : setError('Digite o PIN.'))}>Confirmar</PrimaryButton>
    </div>
  );
}

/* ---------------------------------------------------------
   PIX MODAL
--------------------------------------------------------- */
function PixModal({ amount, description, txid, onClose }) {
  const payload = useMemo(() => buildPixPayload({ amount, description, txid }), [amount, description, txid]);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(payload)}`;
  const [copied, setCopied] = useState(false);

  return (
    <Modal title="Pagar com PIX" onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 14, display: 'inline-block', marginBottom: 14 }}>
          <img src={qrUrl} alt="QR Code PIX" width={220} height={220} style={{ display: 'block' }} />
        </div>
        {amount > 0 && (
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: C.gold, marginBottom: 2 }}>{fmtBRL(amount)}</div>
        )}
        <div style={{ fontSize: 13, color: C.chalk, marginBottom: 2 }}>Chave PIX (celular): <b>{PIX_KEY_RAW}</b></div>
        <div style={{ fontSize: 12, color: C.chalkDim, marginBottom: 16 }}>Super Clássico · Rio de Janeiro</div>

        <div style={{ textAlign: 'left', fontSize: 11, color: C.chalkDim, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Pix Copia e Cola</div>
        <div style={{ wordBreak: 'break-all', background: 'rgba(245,241,230,0.06)', border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, fontSize: 11, color: C.chalkDim, fontFamily: 'monospace', marginBottom: 12, textAlign: 'left' }}>
          {payload}
        </div>
        <PrimaryButton onClick={async () => { const ok = await copyText(payload); setCopied(ok); setTimeout(() => setCopied(false), 2000); }}>
          {copied ? 'Código copiado!' : 'Copiar código PIX'}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   SCOREBOARD (signature element)
--------------------------------------------------------- */
function ScoreboardCard({ players, payments, monthKey, monthLabel, config }) {
  const vasco = players.filter((p) => p.team === 'Vasco');
  const fla = players.filter((p) => p.team === 'Flamengo');

  function sumFor(list) {
    return list.reduce((acc, p) => acc + (payments[p.id]?.[monthKey]?.paid ? Number(payments[p.id][monthKey].amount || 0) : 0), 0);
  }
  const vascoTotal = sumFor(vasco);
  const flaTotal = sumFor(fla);
  const total = vascoTotal + flaTotal;
  const possible = players.length * (config.monthlyFee || 0);
  const pct = possible > 0 ? Math.min(100, Math.round((total / possible) * 100)) : 0;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.line}`, background: C.card }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: `1px solid ${C.line}`, background: C.cardAlt }}>
        <span style={{ fontSize: 10, letterSpacing: 1.2, color: C.chalkDim, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, textTransform: 'uppercase' }}>Arrecadação · {monthLabel}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
          <span style={{ fontSize: 10, color: C.green, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, letterSpacing: 0.5 }}>AO VIVO</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 138 }}>
        <div style={{ width: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 6px', borderRight: `1px solid ${C.line}` }}>
          <VascoEmblem size={34} />
          <span style={{ color: C.chalk, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 11 }}>VASCO</span>
          <span style={{ color: C.gold, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13 }}>{fmtBRL(vascoTotal)}</span>
        </div>

        <div style={{ flex: 1, padding: '16px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, color: C.chalk, lineHeight: 1.1, letterSpacing: 1 }}>{fmtBRL(total)}</div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(245,241,230,0.10)', overflow: 'hidden', margin: '8px 4px 2px' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: C.green, transition: 'width .4s' }} />
          </div>
          <div style={{ fontSize: 11, color: C.chalkDim }}>{pct}% da meta do mês ({fmtBRL(possible)})</div>
        </div>

        <div style={{ width: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 6px', borderLeft: `1px solid ${C.line}` }}>
          <FlamengoEmblem size={34} />
          <span style={{ color: C.chalk, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 11 }}>FLAMENGO</span>
          <span style={{ color: C.gold, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13 }}>{fmtBRL(flaTotal)}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TOP HEADER
--------------------------------------------------------- */
function Header({ currentUser, onLogout }) {
  return (
    <div style={{ padding: 'calc(18px + env(safe-area-inset-top)) 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={18} color={C.gold} />
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 21, color: C.chalk, letterSpacing: 0.5 }}>SUPER CLÁSSICO</span>
        </div>
        <div style={{ fontSize: 12, color: C.chalkDim, marginTop: -2 }}>Quarta-feira · Campo do Furão, Olaria - RJ</div>
      </div>
      {currentUser && (
        <button onClick={onLogout} title="Sair" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: TEAM_STYLE[currentUser.team].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.line}` }}>
            <span style={{ color: TEAM_STYLE[currentUser.team].text, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              {currentUser.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   BOTTOM NAV
--------------------------------------------------------- */
function BottomNav({ view, setView }) {
  const items = [
    { key: 'inicio', label: 'Início', icon: Home },
    { key: 'jogadores', label: 'Jogadores', icon: Users },
    { key: 'presenca', label: 'Presença', icon: Calendar },
    { key: 'financeiro', label: 'Financeiro', icon: Wallet },
    { key: 'perfil', label: 'Perfil', icon: User },
  ];
  return (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0, display: 'flex',
      background: 'rgba(5,15,10,0.96)', backdropFilter: 'blur(6px)',
      borderTop: `1px solid ${C.line}`, paddingBottom: 'calc(6px + env(safe-area-inset-bottom))', paddingTop: 6,
    }}>
      {items.map((it) => {
        const Icon = it.icon;
        const active = view === it.key;
        return (
          <button
            key={it.key}
            onClick={() => setView(it.key)}
            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0' }}
          >
            <Icon size={20} color={active ? C.green : C.chalkDim} />
            <span style={{ fontSize: 10, color: active ? C.green : C.chalkDim, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, letterSpacing: 0.3 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   PLAYER ROW
--------------------------------------------------------- */
function PlayerRow({ player, onClick, right }) {
  const ts = TEAM_STYLE[player.team];
  const posAbbr = POSITIONS.find((p) => p.key === player.position)?.abbr || '';
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ width: 38, height: 38, borderRadius: 999, background: ts.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${C.line}` }}>
        <span style={{ color: ts.text, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          {player.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.chalk, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
          {player.isAdmin === true && <Shield size={13} color={C.gold} />}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: ts.dot, background: ts.chip, padding: '1px 6px', borderRadius: 6, fontWeight: 700, letterSpacing: 0.3 }}>{posAbbr}</span>
          <span style={{ fontSize: 10, color: C.chalkDim }}>{player.team}</span>
        </div>
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------
   MAIN APP
--------------------------------------------------------- */
export default function App() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [view, setView] = useState('inicio');
  const [showRegister, setShowRegister] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [detailPlayer, setDetailPlayer] = useState(null);
  const [pendingAdminClaim, setPendingAdminClaim] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pixModal, setPixModal] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const shared = await window.storage.get(STORAGE_KEY, true);
        if (shared?.value) setData({ ...DEFAULT_DATA, ...JSON.parse(shared.value) });
      } catch (e) { /* no data yet */ }
      try {
        const personal = await window.storage.get('current-user-id', false);
        if (personal?.value) setCurrentUserId(JSON.parse(personal.value));
      } catch (e) { /* no personal selection yet */ }
      setLoading(false);
    })();
  }, []);

  async function persist(next) {
    setData(next);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(next), true); } catch (e) { console.error('storage set failed', e); }
  }
  async function setSession(id) {
    setCurrentUserId(id);
    try { await window.storage.set('current-user-id', JSON.stringify(id), false); } catch (e) { console.error('storage set failed', e); }
  }

  const currentUser = useMemo(() => data.players.find((p) => p.id === currentUserId) || null, [data.players, currentUserId]);
  const isAdmin = currentUser?.isAdmin === true;

  const nextMatch = useMemo(() => getNextMatch(), []);
  const nextMatchKey = matchKeyFor(nextMatch);
  const monthDate = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + monthOffset); return d; }, [monthOffset]);
  const monthKey = monthKeyFor(monthDate);
  const monthLabel = capitalize(monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

  function saveNewPlayer(form) {
    const player = {
      id: uid(), name: form.name, phone: form.phone, team: form.team, position: form.position,
      username: form.username, passwordHash: form.passwordHash, salt: form.salt,
      isAdmin: form.isAdmin === true, createdAt: new Date().toISOString(),
    };
    let next = { ...data, players: [...data.players, player] };
    if (form.newPin) next.config = { ...next.config, adminPin: form.newPin };
    if (form.isAdmin === 'needs-verify') {
      setPendingAdminClaim({ player, next });
      return;
    }
    persist(next);
    setSession(player.id);
    setShowRegister(false);
  }

  function saveEditedPlayer(form) {
    const players = data.players.map((p) => p.id === editingPlayer.id ? {
      ...p, name: form.name, phone: form.phone, team: form.team, position: form.position,
      username: form.username, passwordHash: form.passwordHash, salt: form.salt,
    } : p);
    persist({ ...data, players });
    setEditingPlayer(null);
  }

  function confirmAdminClaim(pin, setError) {
    if (pin !== data.config.adminPin) { setError('PIN incorreto.'); return; }
    const { player, next } = pendingAdminClaim;
    const players = next.players.map((p) => p.id === player.id ? { ...p, isAdmin: true } : p);
    const finalData = { ...next, players };
    persist(finalData);
    setSession(player.id);
    setPendingAdminClaim(null);
    setShowRegister(false);
  }

  function removePlayer(id) {
    const players = data.players.filter((p) => p.id !== id);
    const attendance = {};
    Object.entries(data.attendance).forEach(([k, arr]) => { attendance[k] = arr.filter((pid) => pid !== id); });
    const payments = { ...data.payments };
    delete payments[id];
    persist({ ...data, players, attendance, payments });
    if (currentUserId === id) setSession(null);
    setConfirmDelete(null);
    setDetailPlayer(null);
  }

  function toggleAttendance(playerId) {
    const arr = data.attendance[nextMatchKey] || [];
    const already = arr.includes(playerId);
    const nextArr = already ? arr.filter((id) => id !== playerId) : [...arr, playerId];
    persist({ ...data, attendance: { ...data.attendance, [nextMatchKey]: nextArr } });
  }

  function togglePayment(playerId, mKey) {
    if (!isAdmin) return;
    const key = mKey || monthKey;
    const current = data.payments[playerId]?.[key];
    const paid = !(current?.paid);
    const entry = { paid, amount: data.config.monthlyFee, paidAt: paid ? new Date().toISOString() : null };
    persist({ ...data, payments: { ...data.payments, [playerId]: { ...(data.payments[playerId] || {}), [key]: entry } } });
  }

  function updateFee(newFee) {
    persist({ ...data, config: { ...data.config, monthlyFee: newFee } });
  }

  if (loading) {
    return (
      <div style={{ minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bgGrad, borderRadius: 24 }}>
        <span style={{ color: C.chalkDim, fontFamily: "'Rajdhani',sans-serif" }}>Carregando…</span>
      </div>
    );
  }

  const attendanceArr = data.attendance[nextMatchKey] || [];
  const confirmedVasco = data.players.filter((p) => p.team === 'Vasco' && attendanceArr.includes(p.id));
  const confirmedFla = data.players.filter((p) => p.team === 'Flamengo' && attendanceArr.includes(p.id));
  const filteredPlayers = data.players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="furao-shell" style={{ maxWidth: 420, margin: '0 auto', background: C.bgGrad, minHeight: 600, borderRadius: 24, overflow: 'hidden', fontFamily: "'Inter',sans-serif", boxShadow: '0 20px 60px rgba(0,0,0,0.35)', border: `1px solid ${C.line}` }}>
      <style>{`
        ${FONT_IMPORT}
        html, body { margin: 0; padding: 0; }
        .furao-shell { min-height: 100dvh; }
        @media (max-width: 480px) {
          .furao-shell {
            max-width: 100% !important;
            width: 100% !important;
            min-height: 100dvh !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
        input, button, select, textarea { font-size: 16px; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {!currentUser ? (
        <LoginScreen
          players={data.players}
          onLogin={(id) => setSession(id)}
          onNew={() => setShowRegister(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 600 }}>
          <Header currentUser={currentUser} onLogout={() => setSession(null)} />
          <div style={{ flex: 1, padding: '0 18px 16px', overflowY: 'auto' }}>
            {view === 'inicio' && (
              <InicioView
                data={data} monthKey={monthKey} monthLabel={monthLabel}
                nextMatch={nextMatch} attendanceArr={attendanceArr}
                confirmedVasco={confirmedVasco} confirmedFla={confirmedFla}
                currentUser={currentUser} toggleAttendance={toggleAttendance}
                setView={setView}
              />
            )}
            {view === 'jogadores' && (
              <JogadoresView
                players={filteredPlayers} search={search} setSearch={setSearch}
                onOpen={setDetailPlayer} onNew={() => setShowRegister(true)}
              />
            )}
            {view === 'presenca' && (
              <PresencaView
                nextMatch={nextMatch} data={data} attendanceArr={attendanceArr}
                confirmedVasco={confirmedVasco} confirmedFla={confirmedFla}
                currentUser={currentUser} toggleAttendance={toggleAttendance}
              />
            )}
            {view === 'financeiro' && isAdmin && (
              <FinanceiroView
                data={data} monthKey={monthKey} monthLabel={monthLabel}
                monthOffset={monthOffset} setMonthOffset={setMonthOffset}
                isAdmin={isAdmin} togglePayment={togglePayment}
              />
            )}
            {view === 'financeiro' && !isAdmin && (
              <TeamFinanceiroView
                currentUser={currentUser} data={data} monthKey={monthKey} monthLabel={monthLabel}
                monthOffset={monthOffset} setMonthOffset={setMonthOffset}
                onPay={(amount, mLabel) => setPixModal({ amount, description: `Mensalidade ${mLabel} - ${currentUser.name}`, txid: `SUPERCLASSICO${monthKeyFor(new Date()).replace('-', '')}` })}
              />
            )}
            {view === 'perfil' && (
              <PerfilView
                currentUser={currentUser} isAdmin={isAdmin}
                onLogout={() => setSession(null)}
                onEdit={() => setEditingPlayer(currentUser)}
                onSettings={() => setShowSettings(true)}
                onShowPix={() => setPixModal({ amount: 0, description: `Contribuição - ${currentUser.name}`, txid: 'SUPERCLASSICO' })}
              />
            )}
          </div>
          <BottomNav view={view} setView={setView} />
        </div>
      )}

      {showRegister && (
        <Modal title="Cadastrar jogador" onClose={() => setShowRegister(false)}>
          <PlayerForm players={data.players} hasAdmin={data.players.some((p) => p.isAdmin)} onCancel={() => setShowRegister(false)} onSave={saveNewPlayer} />
        </Modal>
      )}

      {editingPlayer && (
        <Modal title="Editar jogador" onClose={() => setEditingPlayer(null)}>
          <PlayerForm initial={editingPlayer} players={data.players.filter((p) => p.id !== editingPlayer.id)} hasAdmin={data.players.some((p) => p.isAdmin)} onCancel={() => setEditingPlayer(null)} onSave={saveEditedPlayer} />
        </Modal>
      )}

      {pendingAdminClaim && (
        <Modal title="Confirmar cargo de administrador" onClose={() => setPendingAdminClaim(null)}>
          <PinPrompt label="Digite o PIN de administrador existente para confirmar." onConfirm={confirmAdminClaim} />
        </Modal>
      )}

      {detailPlayer && (
        <Modal title={detailPlayer.name} onClose={() => setDetailPlayer(null)}>
          <PlayerDetail
            player={detailPlayer} isAdmin={isAdmin}
            onEdit={() => { setEditingPlayer(detailPlayer); setDetailPlayer(null); }}
            onDelete={() => setConfirmDelete(detailPlayer)}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Remover jogador" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: C.chalk, fontSize: 14, marginBottom: 16 }}>
            Tem certeza que deseja remover <b>{confirmDelete.name}</b>? Isso apaga também seu histórico de presença e pagamentos.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryButton danger onClick={() => removePlayer(confirmDelete.id)}>Remover</PrimaryButton>
          </div>
        </Modal>
      )}

      {showSettings && (
        <Modal title="Configurações" onClose={() => setShowSettings(false)}>
          <SettingsPanel config={data.config} onSave={(fee) => { updateFee(fee); setShowSettings(false); }} />
        </Modal>
      )}

      {pixModal && (
        <PixModal amount={pixModal.amount} description={pixModal.description} txid={pixModal.txid} onClose={() => setPixModal(null)} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   LOGIN SCREEN
--------------------------------------------------------- */
function LoginScreen({ players, onLogin, onNew }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function submit() {
    const u = username.trim().toLowerCase();
    if (!u || !password) { setError('Preencha usuário e senha.'); return; }
    const player = players.find((p) => p.username?.toLowerCase() === u);
    if (!player) { setError('Usuário não encontrado.'); return; }
    setChecking(true);
    const hash = await hashPassword(password, player.salt);
    setChecking(false);
    if (hash !== player.passwordHash) { setError('Senha incorreta.'); return; }
    setError('');
    onLogin(player.id);
  }

  return (
    <div style={{ padding: 'calc(28px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom))', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <Trophy size={30} color={C.gold} style={{ marginBottom: 6 }} />
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, color: C.chalk, letterSpacing: 1 }}>SUPER CLÁSSICO</div>
        <div style={{ fontSize: 13, color: C.chalkDim }}>Quarta-feira · Campo do Furão, Olaria - RJ</div>
      </div>

      {players.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 16 }}>
          {players.slice(0, 10).map((p) => (
            <button key={p.id} onClick={() => setUsername(p.username || '')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, width: 56 }}>
              <div style={{ width: 42, height: 42, borderRadius: 999, background: TEAM_STYLE[p.team].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.line}` }}>
                <span style={{ color: TEAM_STYLE[p.team].text, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{p.name.charAt(0).toUpperCase()}</span>
              </div>
              <span style={{ fontSize: 9, color: C.chalkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 56 }}>{p.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      <Field label="Usuário">
        <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu usuário" autoCapitalize="none" />
      </Field>
      <Field label="Senha">
        <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="sua senha" onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}

      <PrimaryButton onClick={submit} disabled={checking}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Lock size={15} /> Entrar</span>
      </PrimaryButton>

      <div style={{ flex: 1 }} />
      <button onClick={onNew} style={{ marginTop: 16, background: 'none', border: `1px solid ${C.line}`, borderRadius: 10, padding: '13px 16px', color: C.chalk, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        + Cadastrar novo jogador
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   INÍCIO / DASHBOARD
--------------------------------------------------------- */
function InicioView({ data, monthKey, monthLabel, nextMatch, attendanceArr, confirmedVasco, confirmedFla, currentUser, toggleAttendance, setView }) {
  const iConfirmed = attendanceArr.includes(currentUser.id);
  const dateLabel = capitalize(nextMatch.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }));

  return (
    <div>
      <div style={{ height: 4 }} />
      <ScoreboardCard players={data.players} payments={data.payments} monthKey={monthKey} monthLabel={monthLabel} config={data.config} />

      <div style={{ marginTop: 16, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Próximo jogo</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 18, color: C.chalk }}>{dateLabel} · 20h</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: C.gold }}>{attendanceArr.length}</div>
            <div style={{ fontSize: 10, color: C.chalkDim }}>confirmados</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 12, color: C.chalkDim }}>
          <span>Vasco: <b style={{ color: C.chalk }}>{confirmedVasco.length}</b></span>
          <span>·</span>
          <span>Flamengo: <b style={{ color: C.chalk }}>{confirmedFla.length}</b></span>
        </div>
        <PrimaryButton onClick={() => toggleAttendance(currentUser.id)} danger={iConfirmed}>
          {iConfirmed ? 'Cancelar presença' : 'Confirmar presença'}
        </PrimaryButton>
        <button onClick={() => setView('presenca')} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: C.chalkDim, fontSize: 12, cursor: 'pointer' }}>
          Ver lista completa →
        </button>
      </div>

      <div style={{ marginTop: 16, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>Elenco</div>
        <div style={{ display: 'flex', gap: 18 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: C.chalk }}>{data.players.filter(p => p.team === 'Vasco').length}</div>
            <div style={{ fontSize: 11, color: C.chalkDim }}>Vasco</div>
          </div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: C.chalk }}>{data.players.filter(p => p.team === 'Flamengo').length}</div>
            <div style={{ fontSize: 11, color: C.chalkDim }}>Flamengo</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   JOGADORES
--------------------------------------------------------- */
function JogadoresView({ players, search, setSearch, onOpen, onNew }) {
  const vasco = players.filter((p) => p.team === 'Vasco');
  const fla = players.filter((p) => p.team === 'Flamengo');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,241,230,0.06)', border: `1px solid ${C.line}`, borderRadius: 12, padding: '9px 12px', margin: '4px 0 14px' }}>
        <Search size={15} color={C.chalkDim} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jogador…" style={{ background: 'none', border: 'none', outline: 'none', color: C.chalk, fontSize: 14, flex: 1 }} />
      </div>

      {[['Vasco', vasco], ['Flamengo', fla]].map(([team, list]) => (
        <div key={team} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {React.createElement(TEAM_EMBLEM[team], { size: 20 })}
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14, color: C.chalk }}>{team}</span>
            <span style={{ fontSize: 11, color: C.chalkDim }}>({list.length})</span>
          </div>
          {list.length === 0 ? (
            <div style={{ fontSize: 12, color: C.chalkDim, padding: '6px 4px' }}>Nenhum jogador ainda.</div>
          ) : list.map((p) => (
            <div key={p.id} style={{ borderBottom: `1px solid ${C.line}` }}>
              <PlayerRow player={p} onClick={() => onOpen(p)} right={<ChevronRight size={16} color={C.chalkDim} />} />
            </div>
          ))}
        </div>
      ))}

      <PrimaryButton onClick={onNew}>+ Cadastrar novo jogador</PrimaryButton>
    </div>
  );
}

function PlayerDetail({ player, isAdmin, onEdit, onDelete }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: TEAM_STYLE[player.team].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.line}` }}>
          <span style={{ color: TEAM_STYLE[player.team].text, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 18, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{player.name.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C.chalk, fontWeight: 700, fontSize: 16 }}>{player.name}</span>
            {player.isAdmin && <Shield size={14} color={C.gold} />}
          </div>
          <div style={{ fontSize: 12, color: C.chalkDim }}>{player.position} · {player.team}</div>
        </div>
      </div>
      {player.phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.chalk, marginBottom: 10 }}>
          <Phone size={14} color={C.chalkDim} /> {player.phone}
        </div>
      )}
      <div style={{ fontSize: 12, color: C.chalkDim, marginBottom: 16 }}>
        Pagamentos ficam visíveis para o próprio time na aba Financeiro (o administrador vê os dois times).
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onEdit} style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.06)', color: C.chalk, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
            <Pencil size={14} /> Editar
          </button>
          <button onClick={onDelete} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: C.danger, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
            <Trash2 size={14} /> Remover
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   PRESENÇA
--------------------------------------------------------- */
function PresencaView({ nextMatch, data, attendanceArr, confirmedVasco, confirmedFla, currentUser, toggleAttendance }) {
  const iConfirmed = attendanceArr.includes(currentUser.id);
  const dateLabel = capitalize(nextMatch.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }));
  const pastKeys = Object.keys(data.attendance).filter(k => k !== matchKeyFor(nextMatch)).sort().reverse().slice(0, 6);

  return (
    <div>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Próxima partida</div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 19, color: C.chalk, marginBottom: 12 }}>{dateLabel} · 20h</div>
        <PrimaryButton onClick={() => toggleAttendance(currentUser.id)} danger={iConfirmed}>
          {iConfirmed ? 'Cancelar minha presença' : 'Confirmar minha presença'}
        </PrimaryButton>
      </div>

      {[['Vasco', confirmedVasco], ['Flamengo', confirmedFla]].map(([team, list]) => (
        <div key={team} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {React.createElement(TEAM_EMBLEM[team], { size: 20 })}
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14, color: C.chalk }}>{team}</span>
            <span style={{ fontSize: 11, color: C.chalkDim }}>({list.length} confirmados)</span>
          </div>
          {list.length === 0 ? (
            <div style={{ fontSize: 12, color: C.chalkDim, padding: '4px' }}>Ninguém confirmou ainda.</div>
          ) : list.map((p) => (
            <div key={p.id} style={{ borderBottom: `1px solid ${C.line}` }}>
              <PlayerRow player={p} right={<CheckCircle2 size={16} color={C.success} />} />
            </div>
          ))}
        </div>
      ))}

      {pastKeys.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>Jogos anteriores</div>
          {pastKeys.map((k) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 4px', borderBottom: `1px solid ${C.line}`, fontSize: 13, color: C.chalkDim }}>
              <span>{new Date(k + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              <span>{(data.attendance[k] || []).length} confirmados</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   FINANCEIRO (ADMIN) — vê e edita todo mundo
--------------------------------------------------------- */
function FinanceiroView({ data, monthKey, monthLabel, monthOffset, setMonthOffset, isAdmin, togglePayment }) {
  const total = data.players.reduce((acc, p) => acc + (data.payments[p.id]?.[monthKey]?.paid ? Number(data.payments[p.id][monthKey].amount || 0) : 0), 0);
  const pendentes = data.players.filter((p) => !data.payments[p.id]?.[monthKey]?.paid);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => setMonthOffset(monthOffset - 1)} style={{ background: 'rgba(245,241,230,0.08)', border: 'none', borderRadius: 999, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={16} color={C.chalk} />
        </button>
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 16, color: C.chalk }}>{monthLabel}</span>
        <button onClick={() => setMonthOffset(monthOffset + 1)} style={{ background: 'rgba(245,241,230,0.08)', border: 'none', borderRadius: 999, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={16} color={C.chalk} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', fontWeight: 700 }}>Arrecadado</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: C.gold }}>{fmtBRL(total)}</div>
        </div>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', fontWeight: 700 }}>Pendentes</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: C.danger }}>{pendentes.length}</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
        Mensalidade: {fmtBRL(data.config.monthlyFee)} · toque para marcar pago/pendente
      </div>

      {data.players.length === 0 ? (
        <div style={{ fontSize: 13, color: C.chalkDim, marginTop: 12 }}>Cadastre jogadores para começar a controlar o financeiro.</div>
      ) : data.players.map((p) => {
        const paid = data.payments[p.id]?.[monthKey]?.paid;
        return (
          <div key={p.id} style={{ borderBottom: `1px solid ${C.line}` }}>
            <PlayerRow
              player={p}
              onClick={() => togglePayment(p.id, monthKey)}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: paid ? C.success : C.chalkDim, fontWeight: 700 }}>{paid ? 'Pago' : 'Pendente'}</span>
                  {paid ? <CheckCircle2 size={18} color={C.success} /> : <Circle size={18} color={C.chalkDim} />}
                </div>
              }
            />
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   FINANCEIRO DO MEU TIME (não-admin) — vê o time inteiro,
   mas só consegue pagar/editar a própria mensalidade
--------------------------------------------------------- */
function TeamFinanceiroView({ currentUser, data, monthKey, monthLabel, monthOffset, setMonthOffset, onPay }) {
  const ts = TEAM_STYLE[currentUser.team];
  const teammates = data.players.filter((p) => p.team === currentUser.team);
  const total = teammates.reduce((acc, p) => acc + (data.payments[p.id]?.[monthKey]?.paid ? Number(data.payments[p.id][monthKey].amount || 0) : 0), 0);
  const pendentes = teammates.filter((p) => !data.payments[p.id]?.[monthKey]?.paid);
  const myPaid = data.payments[currentUser.id]?.[monthKey]?.paid;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => setMonthOffset(monthOffset - 1)} style={{ background: 'rgba(245,241,230,0.08)', border: 'none', borderRadius: 999, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={16} color={C.chalk} />
        </button>
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 16, color: C.chalk }}>{monthLabel}</span>
        <button onClick={() => setMonthOffset(monthOffset + 1)} style={{ background: 'rgba(245,241,230,0.08)', border: 'none', borderRadius: 999, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={16} color={C.chalk} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {React.createElement(TEAM_EMBLEM[currentUser.team], { size: 22 })}
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14, color: C.chalk }}>Financeiro do {currentUser.team}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', fontWeight: 700 }}>Arrecadado no time</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: C.gold }}>{fmtBRL(total)}</div>
        </div>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', fontWeight: 700 }}>Pendentes</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: pendentes.length > 0 ? C.danger : C.success }}>{pendentes.length}</div>
        </div>
      </div>

      {!myPaid && (
        <div style={{ marginBottom: 16 }}>
          <PrimaryButton onClick={() => onPay(data.config.monthlyFee, monthLabel)}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><QrCode size={15} /> Pagar minha mensalidade ({fmtBRL(data.config.monthlyFee)})</span>
          </PrimaryButton>
        </div>
      )}

      <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
        Jogadores do {currentUser.team} · mensalidade {fmtBRL(data.config.monthlyFee)}
      </div>

      {teammates.map((p) => {
        const paid = data.payments[p.id]?.[monthKey]?.paid;
        const isMe = p.id === currentUser.id;
        return (
          <div key={p.id} style={{ borderBottom: `1px solid ${C.line}`, background: isMe ? 'rgba(255,197,61,0.06)' : 'transparent', borderRadius: isMe ? 10 : 0 }}>
            <PlayerRow
              player={p}
              right={
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: paid ? C.success : C.chalkDim, fontWeight: 700 }}>{paid ? 'Pago' : 'Pendente'}</span>
                  {paid ? <CheckCircle2 size={18} color={C.success} /> : <Circle size={18} color={C.chalkDim} />}
                </span>
              }
            />
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: C.chalkDim, marginTop: 14 }}>
        Você vê os pagamentos do seu próprio time. O outro time e a edição de status ficam com o administrador.
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   PERFIL
--------------------------------------------------------- */
function PerfilView({ currentUser, isAdmin, onLogout, onEdit, onSettings, onShowPix }) {
  const ts = TEAM_STYLE[currentUser.team];
  return (
    <div>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, background: ts.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', border: `1px solid ${C.line}` }}>
          <span style={{ color: ts.text, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 22, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{currentUser.name.charAt(0).toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ color: C.chalk, fontWeight: 700, fontSize: 18 }}>{currentUser.name}</span>
          {isAdmin && <Shield size={15} color={C.gold} />}
        </div>
        <div style={{ fontSize: 12, color: C.chalkDim }}>@{currentUser.username} · {currentUser.position} · {currentUser.team}{isAdmin ? ' · Administrador' : ''}</div>
      </div>

      <button onClick={onEdit} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.05)', color: C.chalk, marginBottom: 10, cursor: 'pointer' }}>
        <Pencil size={16} color={C.chalkDim} /> Editar meus dados e senha
      </button>

      <button onClick={onShowPix} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.05)', color: C.chalk, marginBottom: 10, cursor: 'pointer' }}>
        <QrCode size={16} color={C.chalkDim} /> Mostrar QR Code do PIX
      </button>

      {isAdmin && (
        <button onClick={onSettings} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.05)', color: C.chalk, marginBottom: 10, cursor: 'pointer' }}>
          <Wallet size={16} color={C.chalkDim} /> Configurar valor da mensalidade
        </button>
      )}

      <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.05)', color: C.chalk, cursor: 'pointer' }}>
        <LogOut size={16} color={C.chalkDim} /> Sair
      </button>
    </div>
  );
}

function SettingsPanel({ config, onSave }) {
  const [fee, setFee] = useState(String(config.monthlyFee));
  return (
    <div>
      <Field label="Valor da mensalidade (R$)">
        <input style={inputStyle} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
      </Field>
      <PrimaryButton onClick={() => onSave(Number(fee.replace(',', '.')) || 0)}>Salvar</PrimaryButton>
    </div>
  );
}
