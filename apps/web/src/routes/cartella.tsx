import { Fragment, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { useMutationWithToast } from '@/lib/use-mutation-with-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectGroupLabel } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';

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
  key: string; label: string; unit: string; group: string;
  refText?: string; refLow?: number; refHigh?: number;
  geneticKey?: string; geneticKind?: Kind;
}
// Catalogo esami: unità e intervalli di riferimento tipici di un laboratorio italiano,
// NON dati personali. `geneticKey` collega l'esame al finding genomico per il confronto
// predetto-vs-misurato; gli esami senza chiave non hanno correlato genetico noto.
const CATALOG: AnalyteDef[] = [
  // Lipidi
  { key: 'coltot', label: 'Colesterolo totale', unit: 'mg/dL', group: 'Lipidi', refText: 'desiderabile < 200 mg/dL', refHigh: 200 },
  { key: 'ldl', label: 'Colesterolo LDL', unit: 'mg/dL', group: 'Lipidi', refText: 'desiderabile < 130 mg/dL', refHigh: 130, geneticKey: 'LDL_PGS', geneticKind: 'prs' },
  { key: 'hdl', label: 'Colesterolo HDL', unit: 'mg/dL', group: 'Lipidi', refText: 'rischio basso > 60; rischio alto < 40 mg/dL', refLow: 40 },
  { key: 'tg', label: 'Trigliceridi', unit: 'mg/dL', group: 'Lipidi', refText: 'desiderabile < 150 mg/dL', refHigh: 150 },
  { key: 'lpa', label: 'Lipoproteina(a) — Lp(a)', unit: 'mg/dL', group: 'Lipidi', refText: 'desiderabile < 50 mg/dL', refHigh: 50, geneticKey: 'LPA_PGS', geneticKind: 'prs' },
  { key: 'apob', label: 'ApoB', unit: 'mg/dL', group: 'Lipidi', refText: '< 100 mg/dL (più basso se rischio alto)', refHigh: 100 },
  // Metaboliti e vitamine
  { key: 'glucose', label: 'Glicemia', unit: 'mg/dL', group: 'Metaboliti e vitamine', refText: '70–105 mg/dL (a digiuno)', refLow: 70, refHigh: 105 },
  { key: 'hba1c', label: 'Emoglobina glicata (HbA1c)', unit: '%', group: 'Metaboliti e vitamine', refText: '< 5.7%', refHigh: 5.7, geneticKey: 'HBA1C_PGS', geneticKind: 'prs' },
  { key: 'urate', label: 'Acido urico', unit: 'mg/dL', group: 'Metaboliti e vitamine', refText: '3,5–7,2 mg/dL', refLow: 3.5, refHigh: 7.2, geneticKey: 'URATE_PGS', geneticKind: 'prs' },
  { key: 'hcy', label: 'Omocisteina', unit: 'µmol/L', group: 'Metaboliti e vitamine', refText: '5–15 µmol/L', refLow: 5, refHigh: 15, geneticKey: 'rs1801133', geneticKind: 'trait' },
  { key: 'vitd', label: 'Vitamina D (25-OH)', unit: 'nmol/L', group: 'Metaboliti e vitamine', refText: 'soglia terapeutica ≥ 50 nmol/L; tossicità > 250', refLow: 50, refHigh: 250, geneticKey: 'rs2282679', geneticKind: 'trait' },
  { key: 'b12', label: 'Vitamina B12', unit: 'ng/L', group: 'Metaboliti e vitamine', refText: '180–914 ng/L (≡ pg/mL)', refLow: 180, refHigh: 914, geneticKey: 'rs601338', geneticKind: 'trait' },
  { key: 'folate', label: 'Acido folico', unit: 'µg/L', group: 'Metaboliti e vitamine', refText: '3,1–19,9 µg/L', refLow: 3.1, refHigh: 19.9 },
  { key: 'ferritin', label: 'Ferritina', unit: 'ng/mL', group: 'Metaboliti e vitamine', refText: '24–337 ng/mL', refLow: 24, refHigh: 337, geneticKey: 'rs1800562', geneticKind: 'trait' },
  { key: 'crp', label: 'hs-CRP', unit: 'mg/L', group: 'Metaboliti e vitamine', refText: '< 1 mg/L (basso rischio)', refHigh: 1 },
  // Funzione renale ed elettroliti
  { key: 'creat', label: 'Creatinina', unit: 'mg/dL', group: 'Funzione renale ed elettroliti', refText: '0,60–1,20 mg/dL', refLow: 0.6, refHigh: 1.2 },
  { key: 'egfr', label: 'eGFR (CKD-EPI)', unit: 'mL/min/1.73m²', group: 'Funzione renale ed elettroliti', refText: '> 90 mL/min/1.73m²', refLow: 90 },
  { key: 'sodium', label: 'Sodio', unit: 'mmol/L', group: 'Funzione renale ed elettroliti', refText: '136–146 mmol/L', refLow: 136, refHigh: 146 },
  { key: 'potassium', label: 'Potassio', unit: 'mmol/L', group: 'Funzione renale ed elettroliti', refText: '3,40–4,50 mmol/L', refLow: 3.4, refHigh: 4.5 },
  // Fegato
  { key: 'bili', label: 'Bilirubina totale', unit: 'mg/dL', group: 'Fegato', refText: '0,30–1,20 mg/dL', refLow: 0.3, refHigh: 1.2 },
  { key: 'ast', label: 'AST (GOT)', unit: 'U/L', group: 'Fegato', refText: '0–50 U/L', refHigh: 50 },
  { key: 'alt', label: 'ALT (GPT)', unit: 'U/L', group: 'Fegato', refText: '5–50 U/L', refLow: 5, refHigh: 50 },
  { key: 'ggt', label: 'GGT', unit: 'U/L', group: 'Fegato', refText: '0–55 U/L', refHigh: 55 },
  { key: 'alp', label: 'Fosfatasi alcalina (ALP)', unit: 'U/L', group: 'Fegato', refText: '30–120 U/L', refLow: 30, refHigh: 120 },
  // Tiroide
  { key: 'tsh', label: 'TSH', unit: 'µUI/mL', group: 'Tiroide', refText: '0,350–5,500 µUI/mL', refLow: 0.35, refHigh: 5.5 },
  // Emocromo
  { key: 'wbc', label: 'Leucociti', unit: '×10⁹/L', group: 'Emocromo', refText: '4,50–11,00 ×10⁹/L', refLow: 4.5, refHigh: 11 },
  { key: 'rbc', label: 'Eritrociti', unit: '×10¹²/L', group: 'Emocromo', refText: '4,39–5,77 ×10¹²/L', refLow: 4.39, refHigh: 5.77 },
  { key: 'hgb', label: 'Emoglobina', unit: 'g/dL', group: 'Emocromo', refText: '13,0–17,4 g/dL', refLow: 13, refHigh: 17.4 },
  { key: 'hct', label: 'Ematocrito', unit: '%', group: 'Emocromo', refText: '40–52 %', refLow: 40, refHigh: 52 },
  { key: 'mcv', label: 'MCV', unit: 'fL', group: 'Emocromo', refText: '82–98 fL', refLow: 82, refHigh: 98 },
  { key: 'mch', label: 'MCH', unit: 'pg', group: 'Emocromo', refText: '25–34 pg', refLow: 25, refHigh: 34 },
  { key: 'mchc', label: 'MCHC', unit: 'g/dL', group: 'Emocromo', refText: '32–36 g/dL', refLow: 32, refHigh: 36 },
  { key: 'rdw', label: 'RDW', unit: '%', group: 'Emocromo', refText: '11,4–14,5 %', refLow: 11.4, refHigh: 14.5 },
  { key: 'plt', label: 'Piastrine', unit: '×10⁹/L', group: 'Emocromo', refText: '140–450 ×10⁹/L', refLow: 140, refHigh: 450 },
  { key: 'neut', label: 'Neutrofili', unit: '×10⁹/L', group: 'Emocromo', refText: '1,80–8,20 ×10⁹/L', refLow: 1.8, refHigh: 8.2 },
  { key: 'lymph', label: 'Linfociti', unit: '×10⁹/L', group: 'Emocromo', refText: '1,18–3,62 ×10⁹/L', refLow: 1.18, refHigh: 3.62 },
  { key: 'mono', label: 'Monociti', unit: '×10⁹/L', group: 'Emocromo', refText: '0,23–0,96 ×10⁹/L', refLow: 0.23, refHigh: 0.96 },
  { key: 'eos', label: 'Eosinofili', unit: '×10⁹/L', group: 'Emocromo', refText: '0,03–0,74 ×10⁹/L', refLow: 0.03, refHigh: 0.74 },
  { key: 'baso', label: 'Basofili', unit: '×10⁹/L', group: 'Emocromo', refText: '0,01–0,10 ×10⁹/L', refLow: 0.01, refHigh: 0.1 },
];
const CATALOG_GROUPS: string[] = [...new Set(CATALOG.map((c) => c.group))];
// ordine di catalogo per riga: gli esami di un'analisi si leggono come in un referto
const CATALOG_ORDER: Record<string, number> = Object.fromEntries(CATALOG.map((c, i) => [c.label, i]));

const SEX_LABEL: Record<string, string> = { MALE: 'Maschile', FEMALE: 'Femminile', OTHER: 'Altro' };
const CATALOG_ITEMS: Record<string, string> = {
  ...Object.fromEntries(CATALOG.map((c) => [c.key, c.label])),
  custom: 'Altro (personalizzato)…',
};

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

  // raggruppa gli esami per analisi = sessione di prelievo (stessa data), più recente in cima
  const analyses = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const l of labs) {
      const day = new Date(l.measuredAt).toISOString().slice(0, 10);
      if (!m.has(day)) m.set(day, []);
      m.get(day)!.push(l);
    }
    return [...m.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, rows]) => {
        const ordered = rows.slice().sort((x, y) => (CATALOG_ORDER[x.analyte] ?? 999) - (CATALOG_ORDER[y.analyte] ?? 999));
        let outOfRange = 0, measurable = 0;
        for (const r of rows) {
          const s = rangeStatus(r.value, r.refLow, r.refHigh);
          if (s) measurable++;
          if (s === 'high' || s === 'low') outOfRange++;
        }
        return { day, rows: ordered, outOfRange, measurable };
      });
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
    <AiSummaryProvider vcfFileId={vid} type="cartella" title="Analisi referto">
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Cartella clinica</h1>
        <AiSummaryButton />
      </div>

      <AiSummaryCard />

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4 text-xs text-muted-foreground">
          I dati che inserisci restano <strong>solo sul tuo dispositivo</strong> (database locale): non vengono caricati né condivisi.
          La cartella affianca gli esami misurati alla predizione del tuo DNA — informativo, non una diagnosi.
        </CardContent>
      </Card>

      <ProfileCard profile={profile} onSave={(i) => upsertProfile.mutate(i)} saving={upsertProfile.isPending} />

      <AddLabForm onAdd={(i) => addLab.mutate(i)} adding={addLab.isPending} geneticContext={geneticContext} />

      {/* Esami inseriti, raggruppati per analisi (data di prelievo) */}
      {analyses.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nessun esame inserito. Aggiungine uno qui sopra (es. la Lp(a) dopo il prelievo).</CardContent></Card>
      ) : (
        analyses.map((a) => (
          <AnalysisCard
            key={a.day}
            day={a.day}
            rows={a.rows}
            outOfRange={a.outOfRange}
            measurable={a.measurable}
            geneticContext={geneticContext}
            onDelete={(id) => delLab.mutate(id)}
          />
        ))
      )}
    </div>
    </AiSummaryProvider>
  );
}

function AnalysisCard({ day, rows, outOfRange, measurable, geneticContext, onDelete }: {
  day: string; rows: any[]; outOfRange: number; measurable: number;
  geneticContext: (key?: string, kind?: Kind) => string | null; onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(true); // default compatto: solo il titolo
  const toggle = (id: string) =>
    setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Card>
      <CardHeader
        className="flex-row items-center justify-between space-y-0 pb-3 cursor-pointer select-none"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed((c) => !c); } }}
      >
        <div>
          <CardTitle className="text-base">Analisi del {fmtDate(day)}</CardTitle>
          <CardDescription>{rows.length} {rows.length === 1 ? 'esame' : 'esami'}</CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {outOfRange > 0 ? (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">{outOfRange} fuori range</Badge>
          ) : measurable > 0 ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">nel range</Badge>
          ) : null}
          <span className={`text-muted-foreground text-xs transition-transform ${collapsed ? '' : 'rotate-90'}`} aria-hidden>▶</span>
        </div>
      </CardHeader>
      {!collapsed && (
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Esame</TableHead>
              <TableHead className="text-right">Valore</TableHead>
              <TableHead>Riferimento</TableHead>
              <TableHead className="w-8" aria-label="Azioni" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const def = CATALOG.find((c) => c.label === r.analyte);
              const ctx = geneticContext(r.geneticKey ?? def?.geneticKey, def?.geneticKind);
              const st = rangeStatus(r.value, r.refLow, r.refHigh);
              const isOut = st === 'high' || st === 'low';
              const open = expanded.has(r.id);
              return (
                <Fragment key={r.id}>
                  <TableRow
                    className={ctx ? 'cursor-pointer' : ''}
                    onClick={ctx ? () => toggle(r.id) : undefined}
                    aria-expanded={ctx ? open : undefined}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {r.analyte}
                        {ctx && <span className="text-primary text-xs" title="Confronto con il DNA">🧬</span>}
                      </span>
                      {r.notes && <span className="block text-xs text-muted-foreground italic">{r.notes}</span>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className={`font-mono font-semibold ${isOut ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                        {st === 'high' ? '▲ ' : st === 'low' ? '▼ ' : ''}{r.value}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground ml-1">{r.unit}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-normal">{r.refText || '—'}</TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
                        className="text-muted-foreground hover:text-red-500 text-xs"
                        title="Elimina"
                        aria-label={`Elimina ${r.analyte}`}
                      >✕</button>
                    </TableCell>
                  </TableRow>
                  {ctx && open && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="bg-primary/5 text-[11px] text-primary leading-snug whitespace-normal">
                        🧬 {ctx}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      )}
    </Card>
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
            <Field label="Nome"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
            <Field label="Data di nascita"><Input type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} /></Field>
            <Field label="Sesso">
              <Select value={f.sex || null} onValueChange={(val) => setF({ ...f, sex: val ?? '' })} items={SEX_LABEL}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Maschile</SelectItem>
                  <SelectItem value="FEMALE">Femminile</SelectItem>
                  <SelectItem value="OTHER">Altro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Gruppo sanguigno"><Input placeholder="es. 0+" value={f.bloodType} onChange={(e) => setF({ ...f, bloodType: e.target.value })} /></Field>
            <Field label="Altezza (cm)"><Input type="number" value={f.heightCm} onChange={(e) => setF({ ...f, heightCm: e.target.value })} /></Field>
            <Field label="Peso (kg)"><Input type="number" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Note"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
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

function AddLabForm({ onAdd, adding, geneticContext }: { onAdd: (i: any) => void; adding: boolean; geneticContext: (key?: string, kind?: Kind) => string | null }) {
  const [open, setOpen] = useState(false);
  const [catKey, setCatKey] = useState('coltot');
  const [custom, setCustom] = useState({ analyte: '', unit: '' });
  const [v, setV] = useState({ value: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const def = CATALOG.find((c) => c.key === catKey);
  const isCustom = catKey === 'custom';
  const unit = isCustom ? custom.unit.trim() : def?.unit ?? '';
  const dna = !isCustom && def?.geneticKey ? geneticContext(def.geneticKey, def.geneticKind) : null;
  const canSubmit = (isCustom ? custom.analyte.trim() : true) && v.value.trim() !== '';

  const reset = () => {
    setV({ value: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    setCustom({ analyte: '', unit: '' });
    setCatKey('coltot');
    setOpen(false);
  };

  const submit = () => {
    const analyte = isCustom ? custom.analyte.trim() : def!.label;
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
    reset();
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground hover:bg-secondary/40"
      >
        + Aggiungi esame
      </button>
    );

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Nuovo esame</CardTitle>
          <CardDescription>Inserisci un valore misurato da confrontare con il DNA</CardDescription>
        </div>
        <button onClick={reset} className="text-muted-foreground hover:text-foreground text-lg leading-none" title="Chiudi" aria-label="Chiudi">✕</button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Esame: scelta primaria, a piena larghezza */}
        <Field label="Esame">
          <Select value={catKey} onValueChange={(val) => setCatKey(typeof val === 'string' ? val : 'coltot')} items={CATALOG_ITEMS}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATALOG_GROUPS.map((g) => (
                <SelectGroup key={g}>
                  <SelectGroupLabel>{g}</SelectGroupLabel>
                  {CATALOG.filter((c) => c.group === g).map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectGroup>
              ))}
              <SelectGroup>
                <SelectGroupLabel>Altro</SelectGroupLabel>
                <SelectItem value="custom">Altro (personalizzato)…</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {isCustom ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nome esame"><Input placeholder="es. TSH" value={custom.analyte} onChange={(e) => setCustom({ ...custom, analyte: e.target.value })} /></Field>
            <Field label="Unità"><Input placeholder="es. mIU/L" value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value })} /></Field>
          </div>
        ) : (
          def?.refText && (
            <p className="text-xs text-muted-foreground">
              Riferimento <span className="text-foreground">{def.refText}</span>
            </p>
          )
        )}

        {dna && (
          <p className="text-[11px] text-primary bg-primary/5 rounded px-2 py-1.5 leading-snug">🧬 {dna}</p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Valore">
            <div className="relative">
              <Input type="number" className={unit ? 'pr-14' : ''} placeholder="0" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} />
              {unit && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{unit}</span>}
            </div>
          </Field>
          <Field label="Data del prelievo"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        </div>

        <Field label="Note (opzionale)"><Input placeholder="es. laboratorio, a digiuno…" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={submit} disabled={adding || !canSubmit}>Aggiungi esame</Button>
          <Button size="sm" variant="outline" onClick={reset}>Annulla</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label>{label}</Label>{children}</div>;
}
function Info({ label, value }: { label: string; value?: string | null }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="text-sm">{value || '—'}</div></div>;
}
