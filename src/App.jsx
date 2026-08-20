import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from './firebase.js';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  Home, Users, Calendar, Wallet, User, Shield, Plus, X, Check,
  ChevronLeft, ChevronRight, Search, Trash2, Pencil, Phone,
  CheckCircle2, Circle, Lock, QrCode, Copy, LogOut, Mail, Clock, Trophy,
  Download, Smartphone, Share2
} from 'lucide-react';

/* ---------------------------------------------------------
   TOKENS
--------------------------------------------------------- */
const C = {
  bg: '#000000',
  bgGrad: 'radial-gradient(1100px 700px at 50% -12%, #111111 0%, #000000 55%, #000000 100%)',
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
  { key: 'Presidente', abbr: 'PRES' },
  { key: 'Resenha', abbr: 'RESENHA' },
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
  // estilo neutro para quem não tem time (ex: cargo Resenha)
  Resenha: {
    label: 'Resenha',
    bg: 'rgba(245,241,230,0.12)',
    solid: 'rgba(245,241,230,0.12)',
    text: C.chalk,
    dot: C.chalkDim,
    chip: 'rgba(245,241,230,0.10)',
  },
};

// jogador "sem time" (ex: cargo Resenha) cai no estilo neutro em vez de quebrar
function teamStyleOf(team) {
  return TEAM_STYLE[team] || TEAM_STYLE.Resenha;
}

const DEFAULT_DATA = { players: [], attendance: {}, payments: {}, results: {}, config: { monthlyFee: 70, monthlyFeeResenha: 50, adminPin: null, pixKey: '21998186034' } };
const STORAGE_KEY = 'furao-app-data';

/* ---------------------------------------------------------
   SELOS DE TIME — sigla em bloco de cor (sem escudo)
--------------------------------------------------------- */
function TeamBadge({ team, size = 40 }) {
  const isVasco = team === 'Vasco';
  const label = isVasco ? 'VAS' : 'FLA';
  const bg = isVasco ? C.vascoBlack : C.flaRed;
  const textColor = isVasco ? C.vascoWhite : '#FFFFFF';
  return (
    <div style={{
      width: size * 1.7, height: size * 0.74, borderRadius: size * 0.16,
      background: bg, border: `1.5px solid ${C.gold}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: size * 0.4, color: textColor, letterSpacing: 1 }}>{label}</span>
    </div>
  );
}
function VascoEmblem({ size = 40 }) { return <TeamBadge team="Vasco" size={size} />; }
function FlamengoEmblem({ size = 40 }) { return <TeamBadge team="Flamengo" size={size} />; }

const TEAM_EMBLEM = { Vasco: VascoEmblem, Flamengo: FlamengoEmblem };

const PIX_KEY_RAW = '21998186034';
// Campeão da temporada anterior — o futebol já existia antes deste app,
// então esse título fica registrado manualmente aqui.
const LAST_SEASON_CHAMPION = { year: new Date().getFullYear() - 1, team: 'Flamengo' };

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
function fmtBRL(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// mensalidade fixa: R$70 pra jogadores, R$50 pra Resenha
function feeFor(player, config) {
  return player?.position === 'Resenha' ? Number(config?.monthlyFeeResenha ?? 50) : Number(config?.monthlyFee ?? 70);
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

function getMonthChampion(results, monthKey) {
  let vascoWins = 0;
  let flaWins = 0;
  let empates = 0;
  Object.entries(results || {}).forEach(([matchKey, r]) => {
    if (!matchKey.startsWith(monthKey)) return;
    if (r.winner === 'Vasco') vascoWins++;
    else if (r.winner === 'Flamengo') flaWins++;
    else if (r.winner === 'Empate') empates++;
  });
  let leader = null;
  if (vascoWins > flaWins) leader = 'Vasco';
  else if (flaWins > vascoWins) leader = 'Flamengo';
  return { vascoWins, flaWins, empates, leader, totalGames: vascoWins + flaWins + empates };
}

function getWednesdaysInMonth(year, month) {
  const dates = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === 3) dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

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

function formatPixKey(rawKey) {
  const trimmed = (rawKey || PIX_KEY_RAW).trim();
  if (/^\d{10,11}$/.test(trimmed)) return `+55${trimmed}`;
  return trimmed;
}

function buildPixPayload({ amount, description, txid, pixKey }) {
  const key = formatPixKey(pixKey);
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
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
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
   INSTALAR NO CELULAR (PWA "Adicionar à Tela de Início")
--------------------------------------------------------- */
function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true;
    setIsStandalone(!!standalone);

    const ua = window.navigator.userAgent || '';
    setIsIOS(/iphone|ipad|ipod/i.test(ua) && !window.MSStream);

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);
    return choice?.outcome === 'accepted';
  }

  return { canInstall: !!deferredPrompt, promptInstall, isIOS, isStandalone };
}

function IOSInstallHelp() {
  return (
    <div style={{ fontSize: 13.5, color: C.chalk, lineHeight: 1.7 }}>
      <div style={{ marginBottom: 10 }}>No iPhone/iPad a instalação é feita direto pelo Safari:</div>
      <ol style={{ paddingLeft: 20, margin: '0 0 14px' }}>
        <li>Toque no ícone de <b>Compartilhar</b> <Share2 size={13} style={{ verticalAlign: 'middle' }} /> na barra do Safari.</li>
        <li>Escolha <b>"Adicionar à Tela de Início"</b>.</li>
        <li>Toque em <b>"Adicionar"</b>, no canto superior direito.</li>
      </ol>
      <div style={{ fontSize: 11.5, color: C.chalkDim }}>
        Precisa ser pelo Safari — no iPhone, Chrome e outros navegadores não têm essa opção.
      </div>
    </div>
  );
}

function InstallAppButton({ variant = 'menu' }) {
  const { canInstall, promptInstall, isIOS, isStandalone } = useInstallPrompt();
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  if (isStandalone) return null; // já instalado
  if (!canInstall && !isIOS) return null; // navegador não suporta instalação (ex: desktop sem suporte)

  async function handleClick() {
    if (canInstall) await promptInstall();
    else if (isIOS) setShowIOSHelp(true);
  }

  if (variant === 'banner') {
    return (
      <>
        <button
          onClick={handleClick}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', background: 'rgba(23,232,143,0.08)', border: `1px solid ${C.greenDim}`,
            borderRadius: 10, padding: '12px 14px', color: C.green,
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13.5,
            letterSpacing: 0.3, cursor: 'pointer', marginTop: 14, boxSizing: 'border-box',
          }}
        >
          <Smartphone size={15} /> Instalar app no celular
        </button>
        {showIOSHelp && (
          <Modal title="Adicionar à Tela de Início" onClose={() => setShowIOSHelp(false)}>
            <IOSInstallHelp />
          </Modal>
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        style={{
          width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`,
          background: 'rgba(245,241,230,0.05)', color: C.chalk, marginBottom: 10, cursor: 'pointer',
        }}
      >
        <Download size={16} color={C.chalkDim} /> Instalar app no celular
      </button>
      {showIOSHelp && (
        <Modal title="Adicionar à Tela de Início" onClose={() => setShowIOSHelp(false)}>
          <IOSInstallHelp />
        </Modal>
      )}
    </>
  );
}

/* ---------------------------------------------------------
   PLAYER FORM (create / edit) — inclui usuário e senha
--------------------------------------------------------- */
function PlayerForm({ initial, onCancel, onSave, hasAdmin, players, actingIsAdmin }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [number, setNumber] = useState(initial?.number != null ? String(initial.number) : '');
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
  const isPresidente = position === 'Presidente';
  const isResenha = position === 'Resenha';

  useEffect(() => {
    if (isPresidente) setWantsAdmin(true);
  }, [isPresidente]);

  async function submit() {
    if (!name.trim()) { setError('Digite o nome do jogador.'); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Digite um e-mail válido.'); return; }
    let numberValue = null;
    if (!isResenha) {
      numberValue = Number(number);
      if (!number.trim() || !Number.isInteger(numberValue) || numberValue < 1 || numberValue > 99) {
        setError('Escolha um número de camisa entre 1 e 99.');
        return;
      }
      const numberTaken = players.some((p) => p.team === team && Number(p.number) === numberValue);
      if (numberTaken) { setError(`O número ${numberValue} já está sendo usado por outro jogador do ${team}.`); return; }
    }
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
      if (actingIsAdmin) {
        isAdmin = true;
      } else if (!hasAdmin) {
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
      name: name.trim(), phone: phone.trim(), email: email.trim(),
      number: isResenha ? null : numberValue, team: isResenha ? null : team, position,
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
        <input
          style={inputStyle}
          type="tel"
          inputMode="numeric"
          maxLength={11}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
          placeholder="21999999999"
        />
      </Field>
      <Field label="E-mail (opcional)">
        <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" autoCapitalize="none" />
      </Field>
      {!isResenha && (
        <Field label="Número da camisa">
          <input
            style={inputStyle}
            type="number"
            inputMode="numeric"
            min="1"
            max="99"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="Ex: 10"
          />
        </Field>
      )}
      {!isResenha && (
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
      )}
      {isResenha && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 12, background: 'rgba(245,241,230,0.04)', marginBottom: 14 }}>
          <Users size={16} color={C.chalkDim} />
          <span style={{ fontSize: 12.5, color: C.chalkDim }}>Cargo Resenha: sem time e sem número — não entra na lista de jogadores, só acompanha o rolê.</span>
        </div>
      )}
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

      {((isEdit ? !editingAdminAlready : !hasAdmin) || isPresidente) && (
        <Field label="Cargo administrativo">
          {isPresidente ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 12, background: 'rgba(245,241,230,0.04)' }}>
              <Shield size={16} color={C.gold} />
              <span style={{ fontSize: 14, color: C.chalk }}>Presidente é sempre administrador do app.</span>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 12, background: 'rgba(245,241,230,0.04)' }}>
              <input type="checkbox" checked={wantsAdmin} onChange={(e) => setWantsAdmin(e.target.checked)} />
              <Shield size={16} color={C.gold} />
              <span style={{ fontSize: 14, color: C.chalk }}>Também é administrador (cuida das finanças)</span>
            </label>
          )}
          {wantsAdmin && (
            <div style={{ marginTop: 10 }}>
              {actingIsAdmin ? (
                <div style={{ fontSize: 12, color: C.chalkDim, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={13} color={C.green} /> Como você já é administrador, pode promover direto — sem precisar de PIN.
                </div>
              ) : !hasAdmin ? (
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
function PixModal({ amount, description, playerId, monthKey, email, pixKey, isPaid, onClose }) {
  const dynamic = !!(playerId && monthKey);
  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(dynamic);
  const [orderError, setOrderError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!dynamic) return undefined;
    let cancelled = false;
    setLoadingOrder(true);
    setOrderError('');
    fetch('/api/pix/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, monthKey, amount, description, email }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) { setOrderError(json.error); return; }
        setOrder({ qrCode: json.qrCode, qrCodeBase64: json.qrCodeBase64 });
      })
      .catch(() => { if (!cancelled) setOrderError('Não consegui gerar o PIX. Tente novamente.'); })
      .finally(() => { if (!cancelled) setLoadingOrder(false); });
    return () => { cancelled = true; };
  }, [dynamic, playerId, monthKey, amount, description, email]);

  const staticPayload = useMemo(
    () => (dynamic ? null : buildPixPayload({ amount, description, txid: 'SUPERCLASSICO', pixKey })),
    [dynamic, amount, description, pixKey]
  );
  const payload = dynamic ? order?.qrCode : staticPayload;
  const qrUrl = dynamic
    ? (order?.qrCodeBase64 ? `data:image/png;base64,${order.qrCodeBase64}` : null)
    : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(staticPayload)}`;

  if (dynamic && isPaid) {
    return (
      <Modal title="Pagamento confirmado" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircle2 size={44} color={C.success} style={{ marginBottom: 12 }} />
          <div style={{ color: C.chalk, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Pagamento recebido!</div>
          <div style={{ color: C.chalkDim, fontSize: 13 }}>Seu status já mudou pra "Pago" automaticamente.</div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Pagar com PIX" onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        {dynamic && loadingOrder && (
          <div style={{ padding: '40px 0', color: C.chalkDim, fontSize: 13 }}>Gerando cobrança PIX…</div>
        )}
        {dynamic && !loadingOrder && orderError && (
          <div style={{ padding: '20px 0', color: C.danger, fontSize: 13 }}>{orderError}</div>
        )}
        {(!dynamic || (!loadingOrder && !orderError && payload)) && (
          <>
            <div style={{ background: '#fff', borderRadius: 16, padding: 14, display: 'inline-block', marginBottom: 14 }}>
              <img src={qrUrl} alt="QR Code PIX" width={220} height={220} style={{ display: 'block' }} />
            </div>
            {amount > 0 && (
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: C.gold, marginBottom: 2 }}>{fmtBRL(amount)}</div>
            )}
            {!dynamic && (
              <div style={{ fontSize: 13, color: C.chalk, marginBottom: 2 }}>Chave PIX: <b>{pixKey || PIX_KEY_RAW}</b></div>
            )}
            <div style={{ fontSize: 12, color: C.chalkDim, marginBottom: 16 }}>Super Clássico · Rio de Janeiro</div>

            <div style={{ textAlign: 'left', fontSize: 11, color: C.chalkDim, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Pix Copia e Cola</div>
            <div style={{ wordBreak: 'break-all', background: 'rgba(245,241,230,0.06)', border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, fontSize: 11, color: C.chalkDim, fontFamily: 'monospace', marginBottom: 12, textAlign: 'left' }}>
              {payload}
            </div>
            <button onClick={async () => { const ok = await copyText(payload); setCopied(ok); setTimeout(() => setCopied(false), 2000); }} style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.06)', color: C.chalk, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>
              {copied ? 'Código copiado!' : 'Copiar código PIX'}
            </button>

            {dynamic && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: C.chalkDim, fontSize: 12, padding: '6px 0' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: C.gold, boxShadow: `0 0 6px ${C.gold}` }} />
                Aguardando pagamento — o status muda pra "Pago" sozinho assim que cair.
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   RESULTADO DA PARTIDA (formulário do administrador)
--------------------------------------------------------- */
function MatchResultForm({ matchKey, initial, players, onCancel, onSave }) {
  const [winner, setWinner] = useState(initial?.winner || null);
  const [vascoScore, setVascoScore] = useState(initial?.vascoScore ?? '');
  const [flaScore, setFlaScore] = useState(initial?.flaScore ?? '');
  const [scorers, setScorers] = useState(initial?.scorers?.length ? initial.scorers : [{ name: '', team: 'Vasco', goals: 1 }]);
  const [error, setError] = useState('');

  const dateLabel = new Date(matchKey + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  function updateScorer(i, field, value) {
    setScorers(scorers.map((s, idx) => {
      if (idx !== i) return s;
      const next = { ...s, [field]: value };
      if (field === 'name') {
        const match = players.find((p) => p.name.trim().toLowerCase() === value.trim().toLowerCase());
        if (match) next.team = match.team;
      }
      return next;
    }));
  }
  function addScorer() {
    setScorers([...scorers, { name: '', team: 'Vasco', goals: 1 }]);
  }
  function removeScorer(i) {
    setScorers(scorers.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (!winner) { setError('Selecione quem venceu (ou empate).'); return; }
    const cleanScorers = scorers.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), team: s.team, goals: Number(s.goals) || 1 }));
    setError('');
    onSave({
      winner,
      vascoScore: vascoScore === '' ? 0 : Number(vascoScore),
      flaScore: flaScore === '' ? 0 : Number(flaScore),
      scorers: cleanScorers,
      registeredAt: new Date().toISOString(),
    });
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: C.chalkDim, marginBottom: 14, textTransform: 'capitalize' }}>{dateLabel}</div>

      <Field label="Quem venceu">
        <div style={{ display: 'flex', gap: 8 }}>
          {['Vasco', 'Empate', 'Flamengo'].map((w) => (
            <button
              key={w}
              onClick={() => setWinner(w)}
              style={{
                flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                border: winner === w ? `2px solid ${C.green}` : `1px solid ${C.line}`,
                background: 'rgba(245,241,230,0.05)', color: C.chalk,
                fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13,
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Placar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamBadge team="Vasco" size={26} />
            <input style={{ ...inputStyle, textAlign: 'center' }} type="number" inputMode="numeric" min="0" value={vascoScore} onChange={(e) => setVascoScore(e.target.value)} placeholder="0" />
          </div>
          <span style={{ color: C.chalkDim, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>x</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input style={{ ...inputStyle, textAlign: 'center' }} type="number" inputMode="numeric" min="0" value={flaScore} onChange={(e) => setFlaScore(e.target.value)} placeholder="0" />
            <TeamBadge team="Flamengo" size={26} />
          </div>
        </div>
      </Field>

      <Field label="Goleadores">
        {scorers.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={s.name}
              onChange={(e) => updateScorer(i, 'name', e.target.value)}
              placeholder="Nome do jogador"
              list="players-datalist"
            />
            <select
              value={s.team}
              onChange={(e) => updateScorer(i, 'team', e.target.value)}
              style={{ ...inputStyle, width: 92, padding: '11px 6px' }}
            >
              <option value="Vasco">Vasco</option>
              <option value="Flamengo">Flamengo</option>
            </select>
            <input
              style={{ ...inputStyle, width: 52, textAlign: 'center' }}
              type="number" inputMode="numeric" min="1"
              value={s.goals}
              onChange={(e) => updateScorer(i, 'goals', e.target.value)}
            />
            <button onClick={() => removeScorer(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={16} color={C.chalkDim} />
            </button>
          </div>
        ))}
        <datalist id="players-datalist">
          {players.map((p) => <option key={p.id} value={p.name} />)}
        </datalist>
        <button onClick={addScorer} style={{ background: 'none', border: `1px dashed ${C.line}`, borderRadius: 10, padding: '8px 12px', color: C.chalkDim, fontSize: 13, cursor: 'pointer', width: '100%' }}>
          + Adicionar goleador
        </button>
      </Field>

      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <PrimaryButton onClick={submit}>Salvar resultado</PrimaryButton>
    </div>
  );
}

/* ---------------------------------------------------------
   SCOREBOARD (signature element)
--------------------------------------------------------- */
function ScoreboardCard({ players, payments, monthKey, monthLabel, config }) {
  const vasco = players.filter((p) => p.team === 'Vasco');
  const fla = players.filter((p) => p.team === 'Flamengo');
  const resenha = players.filter((p) => p.position === 'Resenha');

  function sumFor(list) {
    return list.reduce((acc, p) => acc + (payments[p.id]?.[monthKey]?.paid ? Number(payments[p.id][monthKey].amount || 0) : 0), 0);
  }
  const feeJogador = Number(config.monthlyFee ?? 70);
  const feeResenha = Number(config.monthlyFeeResenha ?? 50);
  const vascoTotal = sumFor(vasco);
  const flaTotal = sumFor(fla);
  const resenhaTotal = sumFor(resenha);
  const total = vascoTotal + flaTotal + resenhaTotal;
  const possible = (vasco.length + fla.length) * feeJogador + resenha.length * feeResenha;
  const pct = possible > 0 ? Math.min(100, Math.round((total / possible) * 100)) : 0;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.line}`, background: C.card, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: `1px solid ${C.line}`, background: C.cardAlt }}>
        <span style={{ fontSize: 9, letterSpacing: 1.2, color: C.chalkDim, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, textTransform: 'uppercase' }}>Arrecadação · {monthLabel}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
          <span style={{ fontSize: 9, color: C.green, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, letterSpacing: 0.5 }}>AO VIVO</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 96 }}>
        <div style={{ width: 68, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 4px', borderRight: `1px solid ${C.line}` }}>
          <VascoEmblem size={24} />
          <span style={{ color: C.chalk, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 9 }}>VASCO</span>
          <span style={{ color: C.gold, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 11 }}>{fmtBRL(vascoTotal)}</span>
        </div>

        <div style={{ flex: 1, padding: '10px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: C.chalk, lineHeight: 1.1, letterSpacing: 1 }}>{fmtBRL(total)}</div>
          <div style={{ height: 5, borderRadius: 999, background: 'rgba(245,241,230,0.10)', overflow: 'hidden', margin: '5px 4px 2px' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: C.green, transition: 'width .4s' }} />
          </div>
          <div style={{ fontSize: 10, color: C.chalkDim }}>{pct}% da meta ({fmtBRL(possible)})</div>
        </div>

        <div style={{ width: 68, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 4px', borderLeft: `1px solid ${C.line}` }}>
          <FlamengoEmblem size={24} />
          <span style={{ color: C.chalk, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 9 }}>FLAMENGO</span>
          <span style={{ color: C.gold, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13 }}>{fmtBRL(flaTotal)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderTop: `1px solid ${C.line}`, background: C.cardAlt, gap: 8 }}>
        <span style={{ fontSize: 10, color: C.chalkDim }}>
          Mensalidade: <b style={{ color: C.chalk }}>Jogador {fmtBRL(feeJogador)}</b> · <b style={{ color: C.chalk }}>Resenha {fmtBRL(feeResenha)}</b>
        </span>
        {resenha.length > 0 && (
          <span style={{ fontSize: 10, color: C.chalkDim, whiteSpace: 'nowrap' }}>
            Resenha: <b style={{ color: C.gold }}>{fmtBRL(resenhaTotal)}</b>
          </span>
        )}
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
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: C.chalk, letterSpacing: 0.5 }}>SUPER CLÁSSICO</span>
        </div>
        <div style={{ fontSize: 12, color: C.chalkDim, marginTop: -2 }}>Quarta-feira · Campo do Furão, Olaria - RJ</div>
      </div>
      {currentUser && (
        <button onClick={onLogout} title="Sair" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: teamStyleOf(currentUser.team).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.line}` }}>
            <span style={{ color: teamStyleOf(currentUser.team).text, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
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
function BottomNav({ view, setView, isResenha }) {
  const allItems = [
    { key: 'inicio', label: 'Início', icon: Home },
    { key: 'jogadores', label: 'Jogadores', icon: Users },
    { key: 'presenca', label: 'Presença', icon: Calendar },
    { key: 'placar', label: 'Placar', icon: Trophy },
    { key: 'financeiro', label: 'Financeiro', icon: Wallet },
    { key: 'perfil', label: 'Perfil', icon: User },
  ];
  // cargo Resenha só acessa Início, Jogadores, Presença, Placar e Perfil (sem Financeiro)
  const RESENHA_MENUS = ['inicio', 'jogadores', 'presenca', 'placar', 'financeiro', 'perfil'];
  const items = isResenha ? allItems.filter((it) => RESENHA_MENUS.includes(it.key)) : allItems;
  return (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0, display: 'flex',
      background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(6px)',
      borderTop: `1px solid ${C.line}`, paddingBottom: 'calc(6px + env(safe-area-inset-bottom))', paddingTop: 6,
    }}>
      {items.map((it) => {
        const Icon = it.icon;
        const active = view === it.key;
        return (
          <button
            key={it.key}
            onClick={() => setView(it.key)}
            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0', minWidth: 0 }}
          >
            <Icon size={18} color={active ? C.green : C.chalkDim} />
            <span style={{ fontSize: 9, color: active ? C.green : C.chalkDim, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, letterSpacing: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{it.label}</span>
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
  const ts = teamStyleOf(player.team);
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
          {player.number != null && <span style={{ color: C.gold, fontFamily: "'Bebas Neue',sans-serif", fontSize: 14 }}>#{player.number}</span>}
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
const SHARED_DOC = doc(db, 'furao-fc', STORAGE_KEY);

export default function App() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(() => {
    try { return JSON.parse(localStorage.getItem('furao-current-user-id') || 'null'); }
    catch (e) { return null; }
  });
  const [view, setView] = useState('inicio');
  const [showRegister, setShowRegister] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [detailPlayer, setDetailPlayer] = useState(null);
  const [resetPasswordPlayer, setResetPasswordPlayer] = useState(null);
  const [pendingAdminClaim, setPendingAdminClaim] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPixSettings, setShowPixSettings] = useState(false);
  const [pixModal, setPixModal] = useState(null);
  const [resultModal, setResultModal] = useState(null);

  useEffect(() => {
    let unsubscribeSnapshot = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user && !unsubscribeSnapshot) {
        unsubscribeSnapshot = onSnapshot(
          SHARED_DOC,
          (snap) => {
            setData(snap.exists() ? { ...DEFAULT_DATA, ...snap.data() } : DEFAULT_DATA);
            setSyncError(false);
            setLoading(false);
          },
          (err) => {
            console.error('Firestore sync failed', err);
            setSyncError(true);
            setLoading(false);
          }
        );
      }
    });
    signInAnonymously(auth).catch((err) => {
      console.error('Firebase auth failed', err);
      setSyncError(true);
      setLoading(false);
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  async function persist(next) {
    setData(next);
    try { await setDoc(SHARED_DOC, next); } catch (e) { console.error('firestore write failed', e); }
  }
  function setSession(id) {
    setCurrentUserId(id);
    try { localStorage.setItem('furao-current-user-id', JSON.stringify(id)); } catch (e) { /* ignore */ }
  }

  const currentUser = useMemo(() => data.players.find((p) => p.id === currentUserId) || null, [data.players, currentUserId]);
  const isAdmin = currentUser?.isAdmin === true;
  const isResenha = currentUser?.position === 'Resenha';

  const nextMatch = useMemo(() => getNextMatch(), []);
  const nextMatchKey = matchKeyFor(nextMatch);
  const monthDate = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + monthOffset); return d; }, [monthOffset]);
  const monthKey = monthKeyFor(monthDate);
  const monthLabel = capitalize(monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

  function saveNewPlayer(form) {
    const player = {
      id: uid(), name: form.name, phone: form.phone, email: form.email, number: form.number, team: form.team, position: form.position,
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
    if (form.isAdmin === 'needs-verify') {
      setPendingAdminClaim({
        player: { ...editingPlayer, ...form },
        next: {
          ...data,
          players: data.players.map((p) => p.id === editingPlayer.id ? {
            ...p, name: form.name, phone: form.phone, email: form.email, number: form.number, team: form.team, position: form.position,
            username: form.username, passwordHash: form.passwordHash, salt: form.salt,
          } : p),
        },
        editMode: true,
      });
      return;
    }
    const players = data.players.map((p) => p.id === editingPlayer.id ? {
      ...p, name: form.name, phone: form.phone, email: form.email, number: form.number, team: form.team, position: form.position,
      username: form.username, passwordHash: form.passwordHash, salt: form.salt,
      isAdmin: form.isAdmin === true ? true : p.isAdmin,
    } : p);
    persist({ ...data, players });
    setEditingPlayer(null);
  }

  function confirmAdminClaim(pin, setError) {
    if (pin !== data.config.adminPin) { setError('PIN incorreto.'); return; }
    const { player, next, editMode } = pendingAdminClaim;
    const players = next.players.map((p) => p.id === player.id ? { ...p, isAdmin: true } : p);
    const finalData = { ...next, players };
    persist(finalData);
    setPendingAdminClaim(null);
    if (editMode) {
      setEditingPlayer(null);
    } else {
      setSession(player.id);
      setShowRegister(false);
    }
  }

  async function resetPlayerPassword(playerId, newPassword) {
    const salt = uid();
    const passwordHash = await hashPassword(newPassword, salt);
    const players = data.players.map((p) => p.id === playerId ? { ...p, passwordHash, salt } : p);
    persist({ ...data, players });
    setResetPasswordPlayer(null);
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
    const player = data.players.find((p) => p.id === playerId);
    const entry = { paid, amount: feeFor(player, data.config), paidAt: paid ? new Date().toISOString() : null, claimed: paid ? current?.claimed : false, claimedAt: current?.claimedAt || null };
    persist({ ...data, payments: { ...data.payments, [playerId]: { ...(data.payments[playerId] || {}), [key]: entry } } });
  }

  function updateFee(newFee, newFeeResenha) {
    persist({ ...data, config: { ...data.config, monthlyFee: newFee, monthlyFeeResenha: newFeeResenha } });
  }

  function updatePixKey(newKey) {
    persist({ ...data, config: { ...data.config, pixKey: newKey } });
  }

  function saveResult(matchKey, result) {
    if (!isAdmin) return;
    persist({ ...data, results: { ...data.results, [matchKey]: result } });
    setResultModal(null);
  }

  if (loading) {
    return (
      <div className="furao-shell" style={{ maxWidth: 420, margin: '0 auto', height: 844, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bgGrad, borderRadius: 24 }}>
        <style>{`
          .furao-shell { height: 844px; }
          @media (max-width: 480px) {
            .furao-shell { max-width: 100% !important; width: 100% !important; height: 100dvh !important; border-radius: 0 !important; }
          }
        `}</style>
        <span style={{ color: C.chalkDim, fontFamily: "'Rajdhani',sans-serif" }}>Carregando…</span>
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="furao-shell" style={{ maxWidth: 420, margin: '0 auto', height: 844, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bgGrad, borderRadius: 24, padding: 28, textAlign: 'center' }}>
        <style>{`
          .furao-shell { height: 844px; }
          @media (max-width: 480px) {
            .furao-shell { max-width: 100% !important; width: 100% !important; height: 100dvh !important; border-radius: 0 !important; }
          }
        `}</style>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: C.chalk, marginBottom: 8 }}>Banco de dados não configurado</div>
          <div style={{ color: C.chalkDim, fontSize: 13, lineHeight: 1.5 }}>
            Confira se preencheu as chaves do Firebase em <code>src/firebase.js</code> e se ativou o
            provedor de login <b>Anônimo</b> em Authentication → Sign-in method (veja o README.md).
          </div>
        </div>
      </div>
    );
  }

  const attendanceArr = data.attendance[nextMatchKey] || [];
  const confirmedVasco = data.players.filter((p) => p.team === 'Vasco' && attendanceArr.includes(p.id));
  const confirmedFla = data.players.filter((p) => p.team === 'Flamengo' && attendanceArr.includes(p.id));
  const confirmedResenha = data.players.filter((p) => p.position === 'Resenha' && attendanceArr.includes(p.id));
  const filteredPlayers = data.players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="furao-shell" style={{ maxWidth: 420, margin: '0 auto', background: C.bgGrad, height: 844, borderRadius: 24, overflow: 'hidden', fontFamily: "'Inter',sans-serif", boxShadow: '0 20px 60px rgba(0,0,0,0.35)', border: `1px solid ${C.line}` }}>
      <style>{`
        ${FONT_IMPORT}
        html, body { margin: 0; padding: 0; }
        .furao-shell { height: 844px; }
        @media (max-width: 480px) {
          .furao-shell {
            max-width: 100% !important;
            width: 100% !important;
            height: 100dvh !important;
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
          results={data.results}
          onLogin={(id) => setSession(id)}
          onNew={() => setShowRegister(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Header currentUser={currentUser} onLogout={() => setSession(null)} />
          <div style={{ flex: 1, padding: '0 18px 16px', overflowY: 'auto' }}>
            {view === 'inicio' && (
              <InicioView
                data={data} monthKey={monthKey} monthLabel={monthLabel}
                nextMatch={nextMatch} attendanceArr={attendanceArr}
                confirmedVasco={confirmedVasco} confirmedFla={confirmedFla}
                currentUser={currentUser} toggleAttendance={toggleAttendance}
                setView={setView} isAdmin={isAdmin}
              />
            )}
            {view === 'jogadores' && (
              <JogadoresView
                players={filteredPlayers} search={search} setSearch={setSearch}
                onOpen={setDetailPlayer} onNew={() => setShowRegister(true)} isAdmin={isAdmin}
              />
            )}
            {view === 'presenca' && (
              <PresencaView
                nextMatch={nextMatch} data={data} attendanceArr={attendanceArr}
                confirmedVasco={confirmedVasco} confirmedFla={confirmedFla} confirmedResenha={confirmedResenha}
                currentUser={currentUser} toggleAttendance={toggleAttendance}
                isAdmin={isAdmin} onOpenResult={setResultModal}
              />
            )}
            {view === 'placar' && (
              <PlacarView data={data} isAdmin={isAdmin} onOpenResult={setResultModal} />
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
                onPay={(amount, mLabel) => setPixModal({
                  amount, description: `Mensalidade ${mLabel} - ${currentUser.name}`,
                  playerId: currentUser.id, monthKey, email: currentUser.email,
                })}
              />
            )}
            {view === 'perfil' && (
              <PerfilView
                currentUser={currentUser} isAdmin={isAdmin}
                onLogout={() => setSession(null)}
                onEdit={() => setEditingPlayer(currentUser)}
                onSettings={() => setShowSettings(true)}
                onPixSettings={() => setShowPixSettings(true)}
                onShowPix={() => setPixModal({ amount: 0, description: `Contribuição - ${currentUser.name}` })}
              />
            )}
          </div>
          <BottomNav view={view} setView={setView} isResenha={isResenha} />
        </div>
      )}

      {showRegister && (
        <Modal title="Cadastrar jogador" onClose={() => setShowRegister(false)}>
          <PlayerForm players={data.players} hasAdmin={data.players.some((p) => p.isAdmin)} onCancel={() => setShowRegister(false)} onSave={saveNewPlayer} />
        </Modal>
      )}

      {editingPlayer && (
        <Modal title="Editar jogador" onClose={() => setEditingPlayer(null)}>
          <PlayerForm initial={editingPlayer} players={data.players.filter((p) => p.id !== editingPlayer.id)} hasAdmin={data.players.some((p) => p.isAdmin)} actingIsAdmin={isAdmin} onCancel={() => setEditingPlayer(null)} onSave={saveEditedPlayer} />
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
            onResetPassword={() => { setResetPasswordPlayer(detailPlayer); setDetailPlayer(null); }}
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

      {resetPasswordPlayer && (
        <Modal title={`Resetar senha — ${resetPasswordPlayer.name}`} onClose={() => setResetPasswordPlayer(null)}>
          <ResetPasswordForm onSave={(newPassword) => resetPlayerPassword(resetPasswordPlayer.id, newPassword)} />
        </Modal>
      )}

      {showSettings && (
        <Modal title="Configurações" onClose={() => setShowSettings(false)}>
          <SettingsPanel config={data.config} onSave={(fee, feeResenha) => { updateFee(fee, feeResenha); setShowSettings(false); }} />
        </Modal>
      )}

      {showPixSettings && (
        <Modal title="Chave PIX" onClose={() => setShowPixSettings(false)}>
          <PixSettingsPanel config={data.config} onSave={(key) => { updatePixKey(key); setShowPixSettings(false); }} />
        </Modal>
      )}

      {pixModal && (
        <PixModal
          amount={pixModal.amount} description={pixModal.description}
          playerId={pixModal.playerId} monthKey={pixModal.monthKey} email={pixModal.email}
          pixKey={data.config.pixKey}
          isPaid={pixModal.playerId ? data.payments[pixModal.playerId]?.[pixModal.monthKey]?.paid === true : false}
          onClose={() => setPixModal(null)}
        />
      )}

      {resultModal && (
        <Modal title="Resultado da partida" onClose={() => setResultModal(null)}>
          <MatchResultForm
            matchKey={resultModal}
            initial={data.results[resultModal]}
            players={data.players.filter((p) => p.position !== 'Resenha')}
            onCancel={() => setResultModal(null)}
            onSave={(result) => saveResult(resultModal, result)}
          />
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   LOGIN SCREEN
--------------------------------------------------------- */
function LoginScreen({ players, results, onLogin, onNew }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const monthKey = monthKeyFor(new Date());
  const monthLabel = capitalize(new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  const champion = getMonthChampion(results, monthKey);

  async function submit() {
    const u = username.trim().toLowerCase().replace(/\s+/g, '');
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
    <div style={{ padding: 'calc(28px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom))', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, color: C.chalk, letterSpacing: 1 }}>SUPER CLÁSSICO</span>
        <div style={{ fontSize: 13, color: C.chalkDim, marginTop: 10 }}>
          Quarta-feira · 20h · Campo do Furão, Olaria - RJ <Countdown target={getNextMatch()} discreet /></div>
      </div>

      {champion.totalGames > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 14px', marginBottom: 20 }}>
          <Trophy size={16} color={C.gold} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {champion.leader ? (
              <span style={{ fontSize: 12.5, color: C.chalk }}>
                <b style={{ color: C.gold }}>{champion.leader}</b> lidera o mês · Vasco {champion.vascoWins} x {champion.flaWins} Flamengo
              </span>
            ) : (
              <span style={{ fontSize: 12.5, color: C.chalk }}>Empate parcial · Vasco {champion.vascoWins} x {champion.flaWins} Flamengo</span>
            )}
            <div style={{ fontSize: 10, color: C.chalkDim, marginTop: 1 }}>Parcial de {monthLabel} · mês ainda em andamento</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
      </div>

      <button onClick={onNew} style={{ marginTop: 16, background: 'none', border: `1px solid ${C.line}`, borderRadius: 10, padding: '13px 16px', color: C.chalk, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        + Cadastrar novo jogador
      </button>

      <InstallAppButton variant="banner" />
    </div>
  );
}

/* ---------------------------------------------------------
   INÍCIO / DASHBOARD
--------------------------------------------------------- */
function Countdown({ target, discreet, compact }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = target.getTime() - now;

  if (discreet) {
    if (diff <= 0) {
      return <span style={{ fontSize: 11, color: C.chalkDim }}>· bola rolando (ou já rolou) hoje</span>;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff / 3600000) % 24);
    const m = Math.floor((diff / 60000) % 60);
    const parts = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}min` : `${m}min`;
    return <span style={{ fontSize: 11, color: C.chalkDim }}>· começa em {parts}</span>;
  }

  if (diff <= 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: compact ? '6px 0' : '10px 0' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: C.danger, boxShadow: `0 0 6px ${C.danger}` }} />
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: compact ? 12 : 14, color: C.chalk }}>Bola rolando (ou já rolou) hoje!</span>
      </div>
    );
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const minutes = Math.floor((diff / 60000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const units = [[days, 'dias'], [hours, 'hrs'], [minutes, 'min'], [seconds, 'seg']];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: compact ? 6 : 10, padding: compact ? '6px 0 3px' : '10px 0 4px' }}>
      {units.map(([value, label]) => (
        <div key={label} style={{ textAlign: 'center', minWidth: compact ? 36 : 46 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: compact ? 18 : 26, color: C.gold, lineHeight: 1 }}>{String(value).padStart(2, '0')}</div>
          <div style={{ fontSize: 8, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function InicioView({ data, monthKey, monthLabel, nextMatch, attendanceArr, confirmedVasco, confirmedFla, currentUser, toggleAttendance, setView, isAdmin }) {
  const iConfirmed = attendanceArr.includes(currentUser.id);
  const dateLabel = capitalize(nextMatch.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }));

  return (
    <div>
      <div style={{ height: 2 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card, border: `1px solid ${C.gold}`, borderRadius: 10, padding: '7px 12px', marginBottom: 10 }}>
        <Trophy size={15} color={C.gold} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: C.chalk }}>
          Campeão de {LAST_SEASON_CHAMPION.year}:
        </span>
        <TeamBadge team={LAST_SEASON_CHAMPION.team} size={19} />
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 12, color: C.gold }}>{LAST_SEASON_CHAMPION.team}</span>
      </div>

      {isAdmin && (
        <ScoreboardCard players={data.players} payments={data.payments} monthKey={monthKey} monthLabel={monthLabel} config={data.config} />
      )}

      <div style={{ marginTop: 0, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Próximo jogo</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 16, color: C.chalk }}>{dateLabel} · 20h</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: C.gold }}>{attendanceArr.length}</div>
            <div style={{ fontSize: 9, color: C.chalkDim }}>confirmados</div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
          <Countdown target={nextMatch} compact />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8, fontSize: 11, color: C.chalkDim }}>
          <span>Vasco: <b style={{ color: C.chalk }}>{confirmedVasco.length}</b></span>
          <span>·</span>
          <span>Flamengo: <b style={{ color: C.chalk }}>{confirmedFla.length}</b></span>
        </div>
        <PrimaryButton onClick={() => toggleAttendance(currentUser.id)} danger={iConfirmed} style={{ padding: '10px 16px' }}>
          {iConfirmed ? 'Cancelar presença' : 'Confirmar presença'}
        </PrimaryButton>
        <button onClick={() => setView('presenca')} style={{ width: '100%', marginTop: 6, background: 'none', border: 'none', color: C.chalkDim, fontSize: 11, cursor: 'pointer' }}>
          Ver lista completa →
        </button>
      </div>

      <div style={{ marginTop: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>Elenco</div>
        <div style={{ display: 'flex', gap: 18 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: C.chalk }}>{data.players.filter(p => p.team === 'Vasco').length}</div>
            <div style={{ fontSize: 10, color: C.chalkDim }}>Vasco</div>
          </div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: C.chalk }}>{data.players.filter(p => p.team === 'Flamengo').length}</div>
            <div style={{ fontSize: 10, color: C.chalkDim }}>Flamengo</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   JOGADORES
--------------------------------------------------------- */
function JogadoresView({ players, search, setSearch, onOpen, onNew, isAdmin }) {
  const vasco = players.filter((p) => p.team === 'Vasco');
  const fla = players.filter((p) => p.team === 'Flamengo');
  const resenha = players.filter((p) => p.position === 'Resenha');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,241,230,0.06)', border: `1px solid ${C.line}`, borderRadius: 12, padding: '9px 12px', margin: '4px 0 14px' }}>
        <Search size={15} color={C.chalkDim} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jogador…" style={{ background: 'none', border: 'none', outline: 'none', color: C.chalk, fontSize: 14, flex: 1 }} />
      </div>

      {[['Vasco', vasco], ['Flamengo', fla], ['Resenha', resenha]].map(([label, list]) => (
        list.length === 0 && label === 'Resenha' ? null :
        <div key={label} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {TEAM_EMBLEM[label] ? React.createElement(TEAM_EMBLEM[label], { size: 20 }) : <Users size={20} color={C.chalkDim} />}
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14, color: C.chalk }}>{label}</span>
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

      {isAdmin && <PrimaryButton onClick={onNew}>+ Cadastrar novo jogador</PrimaryButton>}
    </div>
  );
}

function PlayerDetail({ player, isAdmin, onEdit, onDelete, onResetPassword }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: teamStyleOf(player.team).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.line}` }}>
          <span style={{ color: teamStyleOf(player.team).text, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 18, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{player.name.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {player.number != null && <span style={{ color: C.gold, fontFamily: "'Bebas Neue',sans-serif", fontSize: 16 }}>#{player.number}</span>}
            <span style={{ color: C.chalk, fontWeight: 700, fontSize: 16 }}>{player.name}</span>
            {player.isAdmin && <Shield size={14} color={C.gold} />}
          </div>
          <div style={{ fontSize: 12, color: C.chalkDim }}>{player.position} · {player.team}</div>
        </div>
      </div>
      {player.phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.chalk, marginBottom: 8 }}>
          <Phone size={14} color={C.chalkDim} /> {player.phone}
        </div>
      )}
      {player.email && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.chalk, marginBottom: 10 }}>
          <Mail size={14} color={C.chalkDim} /> {player.email}
        </div>
      )}
      <div style={{ fontSize: 12, color: C.chalkDim, marginBottom: 16 }}>
        Pagamentos ficam visíveis para o próprio time na aba Financeiro (o administrador vê os dois times).
      </div>
      {isAdmin && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button onClick={onEdit} style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.06)', color: C.chalk, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
              <Pencil size={14} /> Editar
            </button>
            <button onClick={onDelete} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: C.danger, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
              <Trash2 size={14} /> Remover
            </button>
          </div>
          <button onClick={onResetPassword} style={{ width: '100%', padding: '11px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.06)', color: C.chalk, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
            <Lock size={14} /> Resetar senha
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   RESET DE SENHA (admin define nova senha para o jogador)
--------------------------------------------------------- */
function ResetPasswordForm({ onSave }) {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (password.length < 4) { setError('Crie uma senha com pelo menos 4 caracteres.'); return; }
    if (password !== passwordConfirm) { setError('As senhas não conferem.'); return; }
    setError('');
    setSaving(true);
    await onSave(password);
    setSaving(false);
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: C.chalkDim, marginBottom: 14 }}>
        Defina uma nova senha para o jogador. Avise ele pessoalmente — essa tela não guarda nem mostra a senha depois.
      </div>
      <Field label="Nova senha">
        <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 4 caracteres" />
      </Field>
      <Field label="Confirmar senha">
        <input style={inputStyle} type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Repita a senha" onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <PrimaryButton onClick={submit} disabled={saving}>Salvar nova senha</PrimaryButton>
    </div>
  );
}

/* ---------------------------------------------------------
   PRESENÇA
--------------------------------------------------------- */
function PresencaView({ nextMatch, data, attendanceArr, confirmedVasco, confirmedFla, confirmedResenha, currentUser, toggleAttendance, isAdmin, onOpenResult }) {
  const iConfirmed = attendanceArr.includes(currentUser.id);
  const dateLabel = capitalize(nextMatch.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }));
  const nextKey = matchKeyFor(nextMatch);
  const nextResult = data.results[nextKey];
  const pastKeys = Object.keys(data.attendance).filter(k => k !== nextKey).sort().reverse().slice(0, 6);

  return (
    <div>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Próxima partida</div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 19, color: C.chalk, marginBottom: 12 }}>{dateLabel} · 20h</div>
        <PrimaryButton onClick={() => toggleAttendance(currentUser.id)} danger={iConfirmed}>
          {iConfirmed ? 'Cancelar minha presença' : 'Confirmar minha presença'}
        </PrimaryButton>
        {isAdmin && (
          <button onClick={() => onOpenResult(nextKey)} style={{ width: '100%', marginTop: 10, background: 'none', border: `1px dashed ${C.line}`, borderRadius: 10, padding: '10px 12px', color: C.chalkDim, fontSize: 13, cursor: 'pointer' }}>
            {nextResult ? `Resultado: ${nextResult.winner === 'Empate' ? 'Empate' : nextResult.winner} ${nextResult.vascoScore}x${nextResult.flaScore} · editar` : 'Registrar resultado desta partida'}
          </button>
        )}
      </div>

      {[['Vasco', confirmedVasco], ['Flamengo', confirmedFla], ['Resenha', confirmedResenha]].map(([label, list]) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {TEAM_EMBLEM[label] ? React.createElement(TEAM_EMBLEM[label], { size: 20 }) : <Users size={20} color={C.chalkDim} />}
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14, color: C.chalk }}>{label}</span>
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
          {pastKeys.map((k) => {
            const r = data.results[k];
            return (
              <div key={k} style={{ padding: '9px 4px', borderBottom: `1px solid ${C.line}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: C.chalkDim }}>
                  <span>{new Date(k + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span>{(data.attendance[k] || []).length} confirmados</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  {r ? (
                    <span style={{ fontSize: 12, color: C.gold, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
                      {r.winner === 'Empate' ? 'Empate' : `Vitória do ${r.winner}`} · Vasco {r.vascoScore} x {r.flaScore} Flamengo
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: C.chalkDim }}>Resultado não registrado</span>
                  )}
                  {isAdmin && (
                    <button onClick={() => onOpenResult(k)} style={{ background: 'none', border: 'none', color: C.chalkDim, cursor: 'pointer', padding: 2 }}>
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   PLACAR — vitórias do mês e resultado de cada partida
--------------------------------------------------------- */
function getMonthTopScorers(results, monthKey) {
  const tally = {};
  Object.entries(results || {}).forEach(([matchKey, r]) => {
    if (!matchKey.startsWith(monthKey)) return;
    (r.scorers || []).forEach((s) => {
      const key = `${s.name.trim().toLowerCase()}|${s.team}`;
      if (!tally[key]) tally[key] = { name: s.name.trim(), team: s.team, goals: 0 };
      tally[key].goals += Number(s.goals) || 0;
    });
  });
  return Object.values(tally).sort((a, b) => b.goals - a.goals);
}

/* ---------------------------------------------------------
   PLACAR — vitórias do mês e resultado de cada partida
--------------------------------------------------------- */
function PlacarView({ data, isAdmin, onOpenResult }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [tab, setTab] = useState('vitorias');
  const monthDate = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + monthOffset); return d; }, [monthOffset]);
  const monthKey = monthKeyFor(monthDate);
  const monthLabel = capitalize(monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  const champion = getMonthChampion(data.results, monthKey);
  const topScorers = useMemo(() => getMonthTopScorers(data.results, monthKey), [data.results, monthKey]);
  const wednesdays = useMemo(() => getWednesdaysInMonth(monthDate.getFullYear(), monthDate.getMonth()), [monthDate]);
  const today = new Date(); today.setHours(0, 0, 0, 0);

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

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: C.cardAlt, borderRadius: 10, padding: 4 }}>
        {[['vitorias', 'Vitórias'], ['partidas', 'Partidas'], ['artilharia', 'Artilharia']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === key ? C.green : 'transparent',
              color: tab === key ? '#052015' : C.chalkDim,
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 12.5,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'vitorias' && (
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
          Vitórias do mês
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <div style={{ textAlign: 'center', opacity: champion.leader === 'Flamengo' ? 0.55 : 1 }}>
            <TeamBadge team="Vasco" size={36} />
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, color: champion.leader === 'Vasco' ? C.gold : C.chalk, marginTop: 6 }}>{champion.vascoWins}</div>
          </div>
          <span style={{ color: C.chalkDim, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 16 }}>x</span>
          <div style={{ textAlign: 'center', opacity: champion.leader === 'Vasco' ? 0.55 : 1 }}>
            <TeamBadge team="Flamengo" size={36} />
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, color: champion.leader === 'Flamengo' ? C.gold : C.chalk, marginTop: 6 }}>{champion.flaWins}</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          {champion.totalGames === 0 ? (
            <span style={{ fontSize: 12, color: C.chalkDim }}>Nenhum resultado registrado neste mês ainda.</span>
          ) : champion.leader ? (
            <span style={{ fontSize: 13, color: C.gold, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
              {champion.leader} lidera o mês {champion.empates > 0 ? `· ${champion.empates} empate(s)` : ''}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: C.chalk, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>Empate na disputa do mês</span>
          )}
        </div>
      </div>
      )}

      {tab === 'artilharia' && (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 10 }}>
          Artilharia do mês
        </div>
        {topScorers.length === 0 ? (
          <div style={{ fontSize: 13, color: C.chalkDim, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            Nenhum gol registrado neste mês ainda.
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
            {topScorers.map((s, i) => (
              <div key={`${s.name}-${s.team}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: i < topScorers.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                <span style={{ width: 22, textAlign: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: i === 0 ? C.gold : C.chalkDim }}>{i + 1}º</span>
                <TeamBadge team={s.team} size={22} />
                <span style={{ flex: 1, color: C.chalk, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: C.gold }}>{s.goals}</span>
                <span style={{ fontSize: 10, color: C.chalkDim }}>{s.goals === 1 ? 'gol' : 'gols'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {tab === 'partidas' && (
      <div>
      <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
        Partidas do mês
      </div>

      {wednesdays.length === 0 ? (
        <div style={{ fontSize: 13, color: C.chalkDim }}>Nenhuma quarta-feira neste mês.</div>
      ) : wednesdays.map((d) => {
        const key = matchKeyFor(d);
        const r = data.results[key];
        const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const isFuture = d.getTime() > today.getTime();
        return (
          <div key={key} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.chalkDim, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>Quarta, {dateLabel}</span>
              {isAdmin && !isFuture && (
                <button onClick={() => onOpenResult(key)} style={{ background: 'none', border: 'none', color: C.chalkDim, cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Pencil size={12} /> <span style={{ fontSize: 11 }}>{r ? 'editar' : 'registrar'}</span>
                </button>
              )}
            </div>

            {r ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '10px 0' }}>
                  <TeamBadge team="Vasco" size={24} />
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: C.chalk }}>{r.vascoScore} x {r.flaScore}</span>
                  <TeamBadge team="Flamengo" size={24} />
                </div>
                <div style={{ textAlign: 'center', fontSize: 12, color: C.gold, fontWeight: 700, fontFamily: "'Rajdhani',sans-serif", marginBottom: r.scorers?.length ? 8 : 0 }}>
                  {r.winner === 'Empate' ? 'Empate' : `Vitória do ${r.winner}`}
                </div>
                {r.scorers?.length > 0 && (
                  <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {r.scorers.map((s, i) => (
                      <span key={i} style={{ fontSize: 11, color: C.chalkDim, background: 'rgba(245,241,230,0.05)', borderRadius: 6, padding: '3px 7px' }}>
                        ⚽ {s.name} {s.goals > 1 ? `(${s.goals})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: C.chalkDim, marginTop: 6 }}>
                {isFuture ? 'Ainda não aconteceu.' : 'Resultado não registrado.'}
              </div>
            )}
          </div>
        );
      })}
      </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   FINANCEIRO (ADMIN) — vê e edita todo mundo
--------------------------------------------------------- */
function FinanceiroView({ data, monthKey, monthLabel, monthOffset, setMonthOffset, isAdmin, togglePayment }) {
  // agora Resenha também paga mensalidade (valor menor) e entra no controle financeiro
  const players = data.players;
  const total = players.reduce((acc, p) => acc + (data.payments[p.id]?.[monthKey]?.paid ? Number(data.payments[p.id][monthKey].amount || 0) : 0), 0);
  const pendentes = players.filter((p) => !data.payments[p.id]?.[monthKey]?.paid);
  const aguardando = players.filter((p) => data.payments[p.id]?.[monthKey]?.claimed && !data.payments[p.id]?.[monthKey]?.paid);

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
        {aguardando.length > 0 && (
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', fontWeight: 700 }}>Aguardando</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: C.gold }}>{aguardando.length}</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
        Mensalidade: Jogador {fmtBRL(data.config.monthlyFee ?? 70)} · Resenha {fmtBRL(data.config.monthlyFeeResenha ?? 50)} · toque para marcar pago/pendente
      </div>

      {players.length === 0 ? (
        <div style={{ fontSize: 13, color: C.chalkDim, marginTop: 12 }}>Cadastre jogadores para começar a controlar o financeiro.</div>
      ) : players.map((p) => {
        const entry = data.payments[p.id]?.[monthKey];
        const paid = entry?.paid;
        const claimed = entry?.claimed && !paid;
        return (
          <div key={p.id} style={{ borderBottom: `1px solid ${C.line}` }}>
            <PlayerRow
              player={p}
              onClick={() => togglePayment(p.id, monthKey)}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: paid ? C.success : claimed ? C.gold : C.chalkDim, fontWeight: 700 }}>
                    {paid ? 'Pago' : claimed ? 'Aguardando confirmação' : 'Pendente'}
                  </span>
                  {paid ? <CheckCircle2 size={18} color={C.success} /> : claimed ? <Clock size={18} color={C.gold} /> : <Circle size={18} color={C.chalkDim} />}
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
  const isResenha = currentUser.position === 'Resenha';
  const groupLabel = currentUser.team || 'Resenha';
  const myFee = feeFor(currentUser, data.config);
  // sem time (Resenha), o "grupo" é a galera que também não tem time — ou seja, o próprio Resenha
  const teammates = data.players.filter((p) => p.team === currentUser.team);
  const total = teammates.reduce((acc, p) => acc + (data.payments[p.id]?.[monthKey]?.paid ? Number(data.payments[p.id][monthKey].amount || 0) : 0), 0);
  const pendentes = teammates.filter((p) => !data.payments[p.id]?.[monthKey]?.paid);
  const myEntry = data.payments[currentUser.id]?.[monthKey];
  const myPaid = myEntry?.paid;
  const myClaimed = myEntry?.claimed && !myPaid;

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
        {isResenha ? <Users size={22} color={C.chalkDim} /> : React.createElement(TEAM_EMBLEM[currentUser.team], { size: 22 })}
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14, color: C.chalk }}>Financeiro do {groupLabel}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', fontWeight: 700 }}>Arrecadado</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: C.gold }}>{fmtBRL(total)}</div>
        </div>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: C.chalkDim, textTransform: 'uppercase', fontWeight: 700 }}>Pendentes</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: pendentes.length > 0 ? C.danger : C.success }}>{pendentes.length}</div>
        </div>
      </div>

      {!myPaid && !myClaimed && (
        <div style={{ marginBottom: 16 }}>
          <PrimaryButton onClick={() => onPay(myFee, monthLabel)}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><QrCode size={15} /> Pagar minha mensalidade ({fmtBRL(myFee)})</span>
          </PrimaryButton>
        </div>
      )}
      {myClaimed && (
        <div style={{ marginBottom: 16, background: 'rgba(255,197,61,0.08)', border: `1px solid ${C.gold}`, borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color={C.gold} />
          <span style={{ fontSize: 13, color: C.chalk }}>Você avisou que pagou — aguardando o administrador confirmar.</span>
        </div>
      )}

      <div style={{ fontSize: 11, color: C.chalkDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
        {isResenha ? 'Pessoal do Resenha' : `Jogadores do ${currentUser.team}`} · mensalidade {fmtBRL(myFee)}
      </div>

      {teammates.map((p) => {
        const entry = data.payments[p.id]?.[monthKey];
        const paid = entry?.paid;
        const claimed = entry?.claimed && !paid;
        const isMe = p.id === currentUser.id;
        return (
          <div key={p.id} style={{ borderBottom: `1px solid ${C.line}`, background: isMe ? 'rgba(255,197,61,0.06)' : 'transparent', borderRadius: isMe ? 10 : 0 }}>
            <PlayerRow
              player={p}
              right={
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: paid ? C.success : claimed ? C.gold : C.chalkDim, fontWeight: 700 }}>
                    {paid ? 'Pago' : claimed ? 'Aguardando' : 'Pendente'}
                  </span>
                  {paid ? <CheckCircle2 size={18} color={C.success} /> : claimed ? <Clock size={18} color={C.gold} /> : <Circle size={18} color={C.chalkDim} />}
                </span>
              }
            />
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: C.chalkDim, marginTop: 14 }}>
        Você vê os pagamentos do seu próprio grupo. O resto e a edição de status ficam com o administrador.
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   PERFIL
--------------------------------------------------------- */
function PerfilView({ currentUser, isAdmin, onLogout, onEdit, onSettings, onPixSettings, onShowPix }) {
  const ts = teamStyleOf(currentUser.team);
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
        <div style={{ fontSize: 12, color: C.chalkDim }}>
          @{currentUser.username} · {currentUser.number != null ? `#${currentUser.number} · ` : ''}
          {currentUser.position}{currentUser.team ? ` · ${currentUser.team}` : ''}{isAdmin ? ' · Administrador' : ''}
        </div>
        {currentUser.email && <div style={{ fontSize: 11, color: C.chalkDim, marginTop: 2 }}>{currentUser.email}</div>}
      </div>

      <button onClick={onEdit} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.05)', color: C.chalk, marginBottom: 10, cursor: 'pointer' }}>
        <Pencil size={16} color={C.chalkDim} /> Editar meus dados e senha
      </button>

      <button onClick={onShowPix} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.05)', color: C.chalk, marginBottom: 10, cursor: 'pointer' }}>
        <QrCode size={16} color={C.chalkDim} /> Mostrar QR Code do PIX
      </button>

      <InstallAppButton variant="menu" />

      {isAdmin && (
        <button onClick={onSettings} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.05)', color: C.chalk, marginBottom: 10, cursor: 'pointer' }}>
          <Wallet size={16} color={C.chalkDim} /> Configurar valor da mensalidade
        </button>
      )}

      {isAdmin && (
        <button onClick={onPixSettings} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.05)', color: C.chalk, marginBottom: 10, cursor: 'pointer' }}>
          <QrCode size={16} color={C.chalkDim} /> Trocar a chave PIX
        </button>
      )}

      <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.line}`, background: 'rgba(245,241,230,0.05)', color: C.chalk, cursor: 'pointer' }}>
        <LogOut size={16} color={C.chalkDim} /> Sair
      </button>
    </div>
  );
}

function SettingsPanel({ config, onSave }) {
  const [fee, setFee] = useState(String(config.monthlyFee ?? 70));
  const [feeResenha, setFeeResenha] = useState(String(config.monthlyFeeResenha ?? 50));
  return (
    <div>
      <Field label="Mensalidade dos jogadores (R$)">
        <input style={inputStyle} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
      </Field>
      <Field label="Mensalidade do cargo Resenha (R$)">
        <input style={inputStyle} inputMode="decimal" value={feeResenha} onChange={(e) => setFeeResenha(e.target.value)} />
      </Field>
      <PrimaryButton onClick={() => onSave(Number(fee.replace(',', '.')) || 0, Number(feeResenha.replace(',', '.')) || 0)}>Salvar</PrimaryButton>
    </div>
  );
}

function PixSettingsPanel({ config, onSave }) {
  const [key, setKey] = useState(config.pixKey || '');
  const [error, setError] = useState('');

  function submit() {
    if (!key.trim()) { setError('Digite a chave PIX.'); return; }
    setError('');
    onSave(key.trim());
  }

  return (
    <div>
      <Field label="Chave PIX (celular, e-mail, CPF/CNPJ ou aleatória)">
        <input style={inputStyle} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Ex: 21998186034" autoCapitalize="none" />
      </Field>
      <div style={{ fontSize: 11, color: C.chalkDim, marginBottom: 14 }}>
        Essa é a chave que vai receber as mensalidades pagas via PIX pelo app. Se for um número de celular com 10 ou 11 dígitos, o app formata automaticamente com o +55.
      </div>
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <PrimaryButton onClick={submit}>Salvar</PrimaryButton>
    </div>
  );
}
