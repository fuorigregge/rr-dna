import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { useMutationWithToast } from '@/lib/use-mutation-with-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/cartella')({ component: CartellaPage });

const PROFILE_Q = `query($v:String!){ patientProfile(vcfFileId:$v){ id fullName birthDate sex bloodType heightCm weightKg notes } }`;
const LABS_Q = `query($v:String!){ labResults(vcfFileId:$v){ id analyte value unit measuredAt refLow refHigh refText geneticKey notes } }`;
const PRS_Q = `query($v:ID!){ prsResults(vcfFileId:$v){ traitKey trait percentile zScore interpretation } }`;
const TRAIT_Q = `query($v:String!){ traitPanel(vcfFileId:$v){ rsId gene trait state genotype interpretation } }`;
const UPSERT_PROFILE = `mutation($v:String!,$i:PatientProfileInput!){ upsertPatientProfile(vcfFileId:$v,input:$i){ id } }`;
const ADD_LAB = `mutation($v:String!,$i:LabResultInput!){ addLabResult(vcfFileId:$v,input:$i){ id } }`;
const DEL_LAB = `mutation($id:ID!){ deleteLabResult(id:$id) }`;

type Kind = 'prs' | 'trait';
interface AnalyteDef {
  key: string; label: string; unit: string; refText?: string; refLow?: number; refHigh?: number;
  geneticKey?: string; geneticKind?: Kind;
}
// Catalogo generico (valori di riferimento standard, NON dati personali). geneticKey
// collega l'esame al finding genomico per il confronto predetto-vs-misurato.
const CATALOG: AnalyteDef[] = [
  { key: 'lpa', label: 'Lipoproteina(a) — Lp(a)', unit: 'nmol/L', refText: '< 75 nmol/L (≈ <30 mg/dL)', refHigh: 75, geneticKey: 'LPA_PGS', geneticKind: 'prs' },
  { key: 'apob', label: 'ApoB', unit: 'mg/dL', refText: '< 100 mg/dL (più basso se rischio alto)', refHigh: 100 },
  { key: 'ldl', label: 'Colesterolo LDL', unit: 'mg/dL', refText: '< 100 mg/dL', refHigh: 100, geneticKey: 'LDL_PGS', geneticKind: 'prs' },
  { key: 'hdl', label: 'Colesterolo HDL', unit: 'mg/dL', refText: '> 40' },
  { key: 'tg', label: 'Trigliceridi', unit: 'mg/dL', refText: '< 150 mg/dL', refHigh: 150 },
  { key: 'hcy', label: 'Omocisteina', unit: 'µmol/L', refText: '< 15 µmol/L', refHigh: 15, geneticKey: 'rs1801133', geneticKind: 'trait' },
  { key: 'vitd', label: 'Vitamina D (25-OH)', unit: 'ng/mL', refText: '30–100 ng/mL', refLow: 30, refHigh: 100, geneticKey: 'rs2282679', geneticKind: 'trait' },
  { key: 'b12', label: 'Vitamina B12', unit: 'pg/mL', refText: '200–900 pg/mL', refLow: 200, refHigh: 900, geneticKey: 'rs601338', geneticKind: 'trait' },
  { key: 'hba1c', label: 'Emoglobina glicata (HbA1c)', unit: '%', refText: '< 5.7%', refHigh: 5.7, geneticKey: 'HBA1C_PGS', geneticKind: 'prs' },
  { key: 'ferritin', label: 'Ferritina', unit: 'ng/mL', refText: '30–400 ng/mL', refLow: 30, refHigh: 400, geneticKey: 'rs1800562', geneticKind: 'trait' },
  { key: 'urate', label: 'Acido urico', unit: 'mg/dL', refText: '< 7 mg/dL', refHigh: 7, geneticKey: 'URATE_PGS', geneticKind: 'prs' },
  { key: 'crp', label: 'hs-CRP', unit: 'mg/L', refText: '< 1 mg/L (basso rischio)', refHigh: 1 },
];

const SEX_LABEL: Record<string, string> = { MALE: 'Maschile', FEMALE: 'Femminile', OTHER: 'Altro' };

function rangeStatus(v: number, lo?: number | null, hi?: number | null): 'in' | 'low' | 'high' | null {
  if (lo != null && v < lo) return 'low';
  if (hi != null && v > hi) return 'high';
  if (lo != null || hi != null) return 'in';
  return null;
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function CartellaPage() {
  const { activeFile } = useActiveVcf();
  const qc = useQueryClient();
  const vid = activeFile?.id;

  const { data: profileData } = useQuery({ queryKey: ['patientProfile', vid], queryFn: () => gqlClient.request<any>(PROFILE_Q, { v: vid }), enabled: !!vid });
  const { data: labsData } = useQuery({ queryKey: ['labResults', vid], queryFn: () => gqlClient.request<any>(LABS_Q, { v: vid }), enabled: !!vid });
  const { data: prsData } = useQuery({ queryKey: ['prsResults', vid], queryFn: () => gqlClient.request<any>(PRS_Q, { v: vid }), enabled: !!vid, staleTime: 30_000 });
  const { data: traitData } = useQuery({ queryKey: ['traitPanel', vid], queryFn: () => gqlClient.request<any>(TRAIT_Q, { v: vid }), enabled: !!vid, staleTime: 30_000 });

  const profile = profileData?.patientProfile;
  const labs: any[] = labsData?.labResults ?? [];
  const prs: any[] = prsData?.prsResults ?? [];
  const traits: any[] = traitData?.traitPanel ?? [];

  const geneticContext = (key?: string, kind?: Kind): string | null => {
    if (!key) return null;
    if (kind === 'prs') {
      const p = prs.find((x) => x.traitKey === key);
      return p ? `DNA: ${p.percentile != null ? `${Math.round(p.percentile)}° percentile` : ''} — ${p.interpretation ?? ''}` : null;
    }
    const t = traits.find((x) => x.rsId === key);
    return t ? `DNA: ${t.state === 'CARRIED' ? 'variante portata' : t.state === 'REFERENCE' ? 'riferimento' : 'non valutabile'}${t.genotype ? ` (${t.genotype})` : ''} — ${t.interpretation ?? ''}` : null;
  };

  // raggruppa esami per analita, storico dal più recente
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const l of labs) { if (!m.has(l.analyte)) m.set(l.analyte, []); m.get(l.analyte)!.push(l); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [labs]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['labResults', vid] });
    qc.invalidateQueries({ queryKey: ['patientProfile', vid] });
  };

  const upsertProfile = useMutationWithToast({
    mutationFn: (input: any) => gqlClient.request(UPSERT_PROFILE, { v: vid, i: input }),
    toast: { loading: 'Salvataggio…', success: 'Anagrafica salvata', error: 'Errore nel salvataggio' },
    onSuccess: invalidate,
  });
  const addLab = useMutationWithToast({
    mutationFn: (input: any) => gqlClient.request(ADD_LAB, { v: vid, i: input }),
    toast: { loading: 'Aggiunta esame…', success: 'Esame aggiunto', error: "Errore nell'aggiunta" },
    onSuccess: invalidate,
  });
  const delLab = useMutationWithToast({
    mutationFn: (id: string) => gqlClient.request(DEL_LAB, { id }),
    toast: { loading: 'Eliminazione…', success: 'Esame eliminato', error: "Errore nell'eliminazione" },
    onSuccess: invalidate,
  });

  if (!activeFile) return <div className="text-center text-muted-foreground py-12">Carica un file VCF per usare la cartella clinica.</div>;

  return (
    <div className="space-y-5">
      <style>{`.inp{width:100%;border-radius:.375rem;border:1px solid hsl(var(--border));background:hsl(var(--secondary)/.5);color:hsl(var(--foreground));padding:.375rem .5rem;font-size:.875rem}`}</style>
      <h1 className="text-2xl font-bold">Cartella clinica</h1>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4 text-xs text-muted-foreground">
          I dati che inserisci restano <strong>solo sul tuo dispositivo</strong> (database locale): non vengono caricati né condivisi.
          La cartella affianca gli esami misurati alla predizione del tuo DNA — informativo, non una diagnosi.
        </CardContent>
      </Card>

      <ProfileCard profile={profile} onSave={(i) => upsertProfile.mutate(i)} saving={upsertProfile.isPending} />

      <AddLabForm onAdd={(i) => addLab.mutate(i)} adding={addLab.isPending} />

      {/* Esami inseriti, per analita */}
      {grouped.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nessun esame inserito. Aggiungine uno qui sopra (es. la Lp(a) dopo il prelievo).</CardContent></Card>
      ) : (
        grouped.map(([analyte, rows]) => {
          const def = CATALOG.find((c) => c.label === analyte);
          const ctx = geneticContext(rows[0].geneticKey, def?.geneticKind);
          return (
            <Card key={analyte}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{analyte}</span>
                  {rows[0].refText && <span className="text-[11px] text-muted-foreground">rif: {rows[0].refText}</span>}
                </div>
                {ctx && (
                  <p className="text-[11px] text-primary bg-primary/5 rounded px-2 py-1 leading-snug">🧬 {ctx}</p>
                )}
                <div className="rounded-lg border border-border/60 divide-y divide-border/60">
                  {rows.map((r) => {
                    const st = rangeStatus(r.value, r.refLow, r.refHigh);
                    const stCls = st === 'high' || st === 'low' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : st === 'in' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-secondary text-muted-foreground';
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-mono font-semibold">{r.value} <span className="text-xs font-normal text-muted-foreground">{r.unit}</span></span>
                          {st && <Badge className={`text-[10px] ${stCls}`}>{st === 'high' ? 'sopra range' : st === 'low' ? 'sotto range' : 'nel range'}</Badge>}
                          <span className="text-xs text-muted-foreground">{fmtDate(r.measuredAt)}</span>
                          {r.notes && <span className="text-xs text-muted-foreground italic">· {r.notes}</span>}
                        </div>
                        <button onClick={() => delLab.mutate(r.id)} className="text-muted-foreground hover:text-red-500 text-xs shrink-0" title="Elimina">✕</button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function ProfileCard({ profile, onSave, saving }: { profile: any; onSave: (i: any) => void; saving: boolean }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<any>({});
  const start = () => {
    setF({
      fullName: profile?.fullName ?? '', birthDate: profile?.birthDate ? profile.birthDate.slice(0, 10) : '',
      sex: profile?.sex ?? '', bloodType: profile?.bloodType ?? '',
      heightCm: profile?.heightCm ?? '', weightKg: profile?.weightKg ?? '', notes: profile?.notes ?? '',
    });
    setEdit(true);
  };
  const save = () => {
    onSave({
      fullName: f.fullName || null,
      birthDate: f.birthDate ? new Date(f.birthDate).toISOString() : null,
      sex: f.sex || null, bloodType: f.bloodType || null,
      heightCm: f.heightCm ? parseFloat(f.heightCm) : null,
      weightKg: f.weightKg ? parseFloat(f.weightKg) : null,
      notes: f.notes || null,
    });
    setEdit(false);
  };
  const age = profile?.birthDate ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / 3.15576e10) : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle className="text-base">Anagrafica</CardTitle><CardDescription>Dati del soggetto (solo in locale)</CardDescription></div>
        {!edit && <Button variant="outline" size="sm" onClick={start}>{profile ? 'Modifica' : 'Compila'}</Button>}
      </CardHeader>
      <CardContent>
        {edit ? (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="Nome"><input className="inp" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
            <Field label="Data di nascita"><input type="date" className="inp" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} /></Field>
            <Field label="Sesso">
              <select className="inp" value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}>
                <option value="">—</option><option value="MALE">Maschile</option><option value="FEMALE">Femminile</option><option value="OTHER">Altro</option>
              </select>
            </Field>
            <Field label="Gruppo sanguigno"><input className="inp" placeholder="es. 0+" value={f.bloodType} onChange={(e) => setF({ ...f, bloodType: e.target.value })} /></Field>
            <Field label="Altezza (cm)"><input type="number" className="inp" value={f.heightCm} onChange={(e) => setF({ ...f, heightCm: e.target.value })} /></Field>
            <Field label="Peso (kg)"><input type="number" className="inp" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Note"><textarea className="inp" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
            <div className="sm:col-span-2 flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>Salva</Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(false)}>Annulla</Button>
            </div>
          </div>
        ) : profile ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Info label="Nome" value={profile.fullName} />
            <Info label="Età" value={age != null ? `${age} anni` : null} />
            <Info label="Sesso" value={profile.sex ? SEX_LABEL[profile.sex] : null} />
            <Info label="Gruppo" value={profile.bloodType} />
            <Info label="Altezza" value={profile.heightCm ? `${profile.heightCm} cm` : null} />
            <Info label="Peso" value={profile.weightKg ? `${profile.weightKg} kg` : null} />
            {profile.notes && <div className="col-span-2 sm:col-span-4"><Info label="Note" value={profile.notes} /></div>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Anagrafica non ancora compilata.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AddLabForm({ onAdd, adding }: { onAdd: (i: any) => void; adding: boolean }) {
  const [open, setOpen] = useState(false);
  const [catKey, setCatKey] = useState('lpa');
  const [custom, setCustom] = useState({ analyte: '', unit: '' });
  const [v, setV] = useState({ value: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const def = CATALOG.find((c) => c.key === catKey);
  const isCustom = catKey === 'custom';

  const submit = () => {
    const analyte = isCustom ? custom.analyte.trim() : def!.label;
    const unit = isCustom ? custom.unit.trim() : def!.unit;
    if (!analyte || !v.value) return;
    onAdd({
      analyte, value: parseFloat(v.value), unit,
      measuredAt: new Date(v.date).toISOString(),
      refLow: isCustom ? null : def!.refLow ?? null,
      refHigh: isCustom ? null : def!.refHigh ?? null,
      refText: isCustom ? null : def!.refText ?? null,
      geneticKey: isCustom ? null : def!.geneticKey ?? null,
      notes: v.notes || null,
    });
    setV({ value: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    setCustom({ analyte: '', unit: '' });
    setOpen(false);
  };

  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>+ Aggiungi esame</Button>;
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Field label="Esame">
            <select className="inp" value={catKey} onChange={(e) => setCatKey(e.target.value)}>
              {CATALOG.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              <option value="custom">Altro (personalizzato)…</option>
            </select>
          </Field>
          {isCustom ? (
            <>
              <Field label="Nome esame"><input className="inp" value={custom.analyte} onChange={(e) => setCustom({ ...custom, analyte: e.target.value })} /></Field>
              <Field label="Unità"><input className="inp" value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value })} /></Field>
            </>
          ) : (
            <Field label="Riferimento"><div className="inp bg-secondary/40 text-muted-foreground">{def?.refText ?? '—'}</div></Field>
          )}
          <Field label={`Valore${!isCustom && def ? ` (${def.unit})` : ''}`}><input type="number" className="inp" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} /></Field>
          <Field label="Data"><input type="date" className="inp" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Note (opz.)"><input className="inp" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={adding}>Aggiungi</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>;
}
function Info({ label, value }: { label: string; value?: string | null }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="text-sm">{value || '—'}</div></div>;
}
