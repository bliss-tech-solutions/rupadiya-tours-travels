'use client';

import React, { useEffect, useRef, useState } from 'react';
import PhoneInput from '../../components/ui/PhoneInput';
import {
  UserCog, UserPlus, RefreshCw, Smartphone, MessageCircle, X, Check, ChevronRight, ChevronLeft,
  CreditCard, KeyRound, Bus, Upload, Pencil, Power, Eye, Loader2
} from 'lucide-react';
import { api } from '../../lib/api';

const ID_TYPES = ['Aadhaar', 'Driving Licence', 'Voter ID', 'PAN', 'Passport'];
const STEPS = [['Details & documents', CreditCard], ['Login & password', KeyRound], ['Assign buses', Bus]];

export default function BusManagersPage() {
  const [managers, setManagers] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notifyPhone, setNotifyPhone] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [m, f, n] = await Promise.all([
        api.getManagers(),
        api.getFleet().catch(() => null),
        api.getNotifyPhone().catch(() => null)
      ]);
      setManagers(m?.managers || []);
      setFleet(f?.buses || f?.fleet || f?.data || []);
      setNotifyPhone(n?.notifyPhone || '');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn, successMsg) => {
    setError(''); setMessage(''); setSaving(true);
    try {
      const res = await fn();
      if (res?.success === false) throw new Error(res.error);
      setMessage(successMsg || res?.message || 'Saved.');
      await load();
      return true;
    } catch (e) { setError(e.message); return false; } finally { setSaving(false); }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
            <UserCog className="w-3.5 h-3.5" /> Bus Managers
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Bus Managers</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4" /> Managers travel with the bus and use the Rupadiya Manager app to scan tickets, board and drop passengers.
          </p>
        </div>
        <button onClick={() => { setError(''); setMessage(''); setShowAdd(true); }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-2 cursor-pointer shadow-sm shrink-0">
          <UserPlus className="w-4 h-4" /> Add bus manager
        </button>
      </div>

      {message && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Managers ({managers.length})</h2>
            {loading ? (
              <div className="py-10 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-blue-600" /></div>
            ) : managers.length === 0 ? (
              <p className="text-xs text-slate-500">No bus managers yet. Tap “Add bus manager”.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {managers.map((m) => (
                  <div key={m._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        {m.name}
                        {m.isActive === false && <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">Disabled</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{m.email} · {m.phone} · {m.upcomingTrips || 0} upcoming trip(s)</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setViewing(m._id)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-600 flex items-center gap-1 cursor-pointer"><Eye className="w-3.5 h-3.5" /> View</button>
                      <button onClick={() => { setError(''); setMessage(''); setEditing(m); }} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-600 flex items-center gap-1 cursor-pointer"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                      <button disabled={saving} onClick={() => run(() => api.updateManager(m._id, { isActive: m.isActive === false }))}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center gap-1 ${m.isActive === false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                        <Power className="w-3.5 h-3.5" /> {m.isActive === false ? 'Enable' : 'Disable'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Default manager per bus</h2>
            <p className="text-[11px] text-slate-500 mb-3">New trips of a bus get this manager automatically. You can still change it per trip (even mid-route) in the Trip Scheduler.</p>
            {fleet.length === 0 ? <p className="text-xs text-slate-500">No buses found.</p> : (
              <div className="divide-y divide-slate-100">
                {fleet.map((b) => (
                  <div key={b._id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900">{b.busNumber} <span className="text-slate-500 font-normal">{b.name}</span></span>
                    <select defaultValue={b.defaultManagerId || ''} disabled={saving}
                      onChange={(e) => run(() => api.setBusDefaultManager(b._id, e.target.value || null, true))}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white">
                      <option value="">No default manager</option>
                      {managers.filter((m) => m.isActive !== false).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <form onSubmit={(e) => { e.preventDefault(); run(() => api.saveNotifyPhone(notifyPhone)); }} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Trip updates on WhatsApp</h2>
            <p className="text-[11px] text-slate-500">Rupadiya Bus Samiti sends “journey started” and “journey completed” summaries for your buses to this number.</p>
            <PhoneInput size="sm" value={notifyPhone} onChange={setNotifyPhone} />
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">Save number</button>
          </form>
        </div>
      </div>

      {showAdd && <AddManagerWizard fleet={fleet} onClose={() => setShowAdd(false)} onCreated={(msg) => { setShowAdd(false); setMessage(msg); load(); }} />}
      {editing && <EditManagerModal manager={editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); setMessage(msg); load(); }} />}
      {viewing && <ManagerDetailModal id={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// -- Document uploader ------------------------------------------------------
function DocUpload({ label, value, onChange, accept = 'image/*,application/pdf' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (file) => {
    if (!file) return;
    setBusy(true); setErr('');
    try { const url = await api.uploadFile(file, 'managers'); onChange(url); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div>
      <label className="text-[11px] font-bold text-slate-700 block mb-1">{label}</label>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}
        className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-dashed border-slate-300 bg-slate-50 text-slate-500'}`}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : value ? <Check className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
        {busy ? 'Uploading…' : value ? 'Uploaded — replace' : 'Upload file'}
      </button>
      {err ? <p className="text-[10px] text-rose-600 mt-1">{err}</p> : null}
    </div>
  );
}

const field = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-blue-500';
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const pwOk = (p) => p.length >= 8 && /\d/.test(p) && /[a-zA-Z]/.test(p);

function Shell({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// -- Add wizard (3 steps) ---------------------------------------------------
function AddManagerWizard({ fleet, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    name: '', phone: '', idType: 'Aadhaar', idNumber: '', idProofUrl: '', photoUrl: '', address: '', notes: '',
    email: '', password: '', busIds: [], assignUpcoming: true
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  const stepValid = () => {
    if (step === 0) return f.name.trim().length >= 2 && f.phone && /\d/.test(f.phone);
    if (step === 1) return emailOk(f.email) && pwOk(f.password);
    return true;
  };

  const toggleBus = (id) => set({ busIds: f.busIds.includes(id) ? f.busIds.filter((x) => x !== id) : [...f.busIds, id] });

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const res = await api.createManager({
        name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone, password: f.password,
        documents: { idType: f.idType, idNumber: f.idNumber.trim(), idProofUrl: f.idProofUrl, photoUrl: f.photoUrl, address: f.address.trim(), notes: f.notes.trim() },
        busIds: f.busIds, assignUpcoming: f.assignUpcoming
      });
      if (res?.success === false) throw new Error(res.error);
      onCreated(res?.message || 'Bus manager created.');
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <Shell title="Add bus manager" onClose={busy ? () => {} : onClose} wide>
      {/* stepper */}
      <div className="flex items-center gap-2 mb-5">
        {STEPS.map(([label, Icon], i) => (
          <React.Fragment key={label}>
            <div className={`flex items-center gap-2 ${i === step ? 'text-blue-700' : i < step ? 'text-emerald-600' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${i === step ? 'border-blue-600 bg-blue-50' : i < step ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                {i < step ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className="text-xs font-bold hidden sm:block">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Full name *</label>
            <input value={f.name} onChange={(e) => set({ name: e.target.value })} className={field} placeholder="e.g. Mohan Lal" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Contact number *</label>
            <PhoneInput size="sm" required value={f.phone} onChange={(v) => set({ phone: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">ID type</label>
              <select value={f.idType} onChange={(e) => set({ idType: e.target.value })} className={`${field} bg-white`}>
                {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">ID number</label>
              <input value={f.idNumber} onChange={(e) => set({ idNumber: e.target.value })} className={field} placeholder="ID / licence no." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DocUpload label="ID proof (photo / PDF)" value={f.idProofUrl} onChange={(url) => set({ idProofUrl: url })} />
            <DocUpload label="Manager photo" value={f.photoUrl} onChange={(url) => set({ photoUrl: url })} accept="image/*" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Address</label>
            <input value={f.address} onChange={(e) => set({ address: e.target.value })} className={field} placeholder="Town / city" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Notes (optional)</label>
            <input value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={field} placeholder="Anything useful" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">These are the login details the manager uses in the Rupadiya Manager app.</p>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Login email *</label>
            <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className={field} placeholder="manager@company.in" />
            {f.email && !emailOk(f.email) ? <p className="text-[10px] text-rose-600 mt-1">Enter a valid email.</p> : null}
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Password *</label>
            <input value={f.password} onChange={(e) => set({ password: e.target.value })} className={field} placeholder="8+ chars with letters & numbers" />
            {f.password && !pwOk(f.password) ? <p className="text-[10px] text-rose-600 mt-1">At least 8 characters with letters and numbers.</p> : null}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Set this manager as the default for the buses they run. New trips of these buses get them automatically — you can still change it per trip later.</p>
          {(!fleet || fleet.length === 0) ? <p className="text-xs text-slate-500">No buses yet. You can assign buses later.</p> : (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {fleet.map((b) => (
                <label key={b._id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={f.busIds.includes(b._id)} onChange={() => toggleBus(b._id)} className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm font-semibold text-slate-800">{b.busNumber}</span>
                  <span className="text-xs text-slate-500">{b.name}</span>
                </label>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={f.assignUpcoming} onChange={(e) => set({ assignUpcoming: e.target.checked })} className="w-4 h-4 accent-blue-600" />
            Also assign them to the upcoming scheduled trips of these buses
          </label>
        </div>
      )}

      {err ? <div className="mt-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{err}</div> : null}

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
        <button onClick={() => (step === 0 ? onClose() : setStep(step - 1))} disabled={busy}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 flex items-center gap-1 cursor-pointer">
          {step === 0 ? 'Cancel' : <><ChevronLeft className="w-4 h-4" /> Back</>}
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => stepValid() && setStep(step + 1)} disabled={!stepValid()}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create manager
          </button>
        )}
      </div>
    </Shell>
  );
}

// -- Edit modal -------------------------------------------------------------
function EditManagerModal({ manager, onClose, onSaved }) {
  const [f, setF] = useState({
    name: manager.name || '', phone: manager.phone || '',
    idType: manager.managerProfile?.idType || '', idNumber: manager.managerProfile?.idNumber || '',
    address: manager.managerProfile?.address || '', notes: manager.managerProfile?.notes || '', password: ''
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  const save = async () => {
    if (f.password && !pwOk(f.password)) { setErr('Password must be 8+ chars with letters and numbers.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await api.updateManager(manager._id, {
        name: f.name.trim(), phone: f.phone,
        documents: { idType: f.idType, idNumber: f.idNumber, address: f.address, notes: f.notes },
        ...(f.password ? { password: f.password } : {})
      });
      if (res?.success === false) throw new Error(res.error);
      onSaved('Bus manager updated.');
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <Shell title={`Edit ${manager.name}`} onClose={busy ? () => {} : onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-bold text-slate-700 block mb-1">Full name</label>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} className={field} />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 block mb-1">Contact number</label>
          <PhoneInput size="sm" value={f.phone} onChange={(v) => set({ phone: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">ID type</label>
            <select value={f.idType} onChange={(e) => set({ idType: e.target.value })} className={`${field} bg-white`}>
              <option value="">—</option>
              {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">ID number</label>
            <input value={f.idNumber} onChange={(e) => set({ idNumber: e.target.value })} className={field} />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 block mb-1">Address</label>
          <input value={f.address} onChange={(e) => set({ address: e.target.value })} className={field} />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 block mb-1">Reset password (optional)</label>
          <input value={f.password} onChange={(e) => set({ password: e.target.value })} className={field} placeholder="Leave blank to keep current" />
        </div>
        {err ? <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{err}</div> : null}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold cursor-pointer">Cancel</button>
          <button onClick={save} disabled={busy} className="flex-[1.5] py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold cursor-pointer disabled:opacity-60">{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </Shell>
  );
}

// -- Detail modal -----------------------------------------------------------
function ManagerDetailModal({ id, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.getManager(id).then(setData).catch((e) => setErr(e.message)); }, [id]);
  const m = data?.manager;
  const p = m?.managerProfile || {};
  return (
    <Shell title={m ? m.name : 'Bus manager'} onClose={onClose}>
      {err ? <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{err}</div> : !data ? (
        <div className="py-8 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Info label="Email" value={m.email} />
            <Info label="Phone" value={m.phone} />
            <Info label="Status" value={m.isActive === false ? 'Disabled' : 'Active'} />
            <Info label="ID" value={[p.idType, p.idNumber].filter(Boolean).join(' · ') || '—'} />
            <Info label="Address" value={p.address || '—'} />
            {p.notes ? <Info label="Notes" value={p.notes} /> : null}
          </div>
          {(p.idProofUrl || p.photoUrl) && (
            <div className="flex gap-2">
              {p.idProofUrl ? <a href={p.idProofUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-blue-700 cursor-pointer">View ID proof</a> : null}
              {p.photoUrl ? <a href={p.photoUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-blue-700 cursor-pointer">View photo</a> : null}
            </div>
          )}
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Default buses</div>
            {data.defaultBuses?.length ? <div className="flex flex-wrap gap-1.5">{data.defaultBuses.map((b) => <span key={b._id} className="px-2 py-1 rounded-lg bg-slate-100 text-xs font-semibold">{b.busNumber}</span>)}</div> : <p className="text-xs text-slate-400">None</p>}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Upcoming trips ({data.upcomingTrips?.length || 0})</div>
            {data.upcomingTrips?.length ? (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {data.upcomingTrips.map((t) => (
                  <div key={t._id} className="px-3 py-2 text-xs flex justify-between">
                    <span className="font-semibold text-slate-800">{t.routeId?.fromCity?.name} → {t.routeId?.toCity?.name}</span>
                    <span className="text-slate-500">{new Date(t.departureTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })} · {t.busId?.busNumber}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400">None</p>}
          </div>
        </div>
      )}
    </Shell>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-slate-500 uppercase">{label}</div>
      <div className="text-slate-800 font-semibold break-words">{value}</div>
    </div>
  );
}
