"use client";

/**
 * FEATURE 9 — Offline QR Medical Pass.
 * Encodes the victim's critical medical data as a QR code ANY camera app
 * can scan — zero app, zero network required. Data lives in localStorage
 * (works 100% offline) and optionally mirrors to the cloud DB.
 */
import * as React from "react";
import { QRCodeCanvas } from "qrcode.react";
import { motion } from "framer-motion";
import { Download, Smartphone, RefreshCw, HeartPulse, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useOnline, usePwaInstall } from "@/components/providers";
import { BLOOD_GROUPS, cuidOrStable } from "@/lib/client-helpers";

interface MedicalProfileForm {
  name: string;
  bloodGroup: string;
  allergies: string;
  conditions: string;
  emergencyContact: string;
}

const EMPTY: MedicalProfileForm = {
  name: "",
  bloodGroup: "O+",
  allergies: "",
  conditions: "",
  emergencyContact: "",
};

const LS_KEY = "crisissync_med_profile";

/** Encode the medical pass payload carried inside the offline QR code. */
function buildPayload(f: MedicalProfileForm): string {
  return JSON.stringify({
    v: 1,
    app: "CrisisSync MedicalPass",
    name: f.name,
    bloodGroup: f.bloodGroup,
    allergies: f.allergies || "None reported",
    conditions: f.conditions || "None reported",
    emergencyContact: f.emergencyContact,
  });
}

export default function QRMedicalPass() {
  const [form, setForm] = React.useState<MedicalProfileForm>(EMPTY);
  const [qrPayload, setQrPayload] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const qrWrapRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { online } = useOnline();
  const pwa = usePwaInstall();

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { form: MedicalProfileForm; savedAt: string };
        setForm({ ...EMPTY, ...parsed.form });
        setSavedAt(parsed.savedAt);
        setQrPayload(buildPayload({ ...EMPTY, ...parsed.form }));
      }
    } catch {
      /* private mode etc. — pass stays in-memory */
    }
  }, []);

  const set = (k: keyof MedicalProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim() || !form.emergencyContact.trim()) {
      toast({ title: "Name and emergency contact are required", variant: "warning" });
      return;
    }
    const savedAt = new Date().toISOString();
    setSavedAt(savedAt);
    setQrPayload(buildPayload(form));
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ form, savedAt }));
    } catch { /* offline storage full — QR still generated in-memory */ }
    toast({ title: "Medical Pass generated", description: "Works fully offline — rescuers scan with any camera app.", variant: "success" });

    // Best-effort cloud mirror (never blocks the offline flow)
    if (online) {
      setSyncing(true);
      try {
        await fetch("/api/medical", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: cuidOrStable(), ...form }),
        });
      } catch { /* mirror is optional */ }
      setSyncing(false);
    }
  };

  const regenerate = () => {
    setQrPayload(null);
    setForm(EMPTY);
    try {
      localStorage.removeItem(LS_KEY);
    } catch { /* noop */ }
    setSavedAt(null);
  };

  const downloadQr = () => {
    const canvas = qrWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "crisissync-medical-pass.png";
    a.click();
    toast({ title: "QR downloaded", description: "Set it as your lock-screen wallpaper for instant rescuer access.", variant: "success" });
  };

  const install = async () => {
    if (pwa.canInstall) {
      await pwa.install();
      toast({ title: "Installed to home screen", variant: "success" });
    } else {
      toast({
        title: "Add to home screen",
        description: "Open your browser menu and choose 'Add to Home Screen' — CrisisSync works offline after that.",
      });
    }
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* ── form ── */}
      <div className="flex flex-col gap-3.5">
        <div>
          <Label htmlFor="mp-name">Full name</Label>
          <Input id="mp-name" value={form.name} onChange={set("name")} placeholder="Aisha Verma" autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="mp-blood">Blood group</Label>
          <Select id="mp-blood" value={form.bloodGroup} onChange={set("bloodGroup")}>
            {BLOOD_GROUPS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="mp-allergy">Allergies</Label>
          <Input id="mp-allergy" value={form.allergies} onChange={set("allergies")} placeholder="Penicillin, peanuts…" />
        </div>
        <div>
          <Label htmlFor="mp-cond">Medical conditions</Label>
          <Textarea id="mp-cond" value={form.conditions} onChange={set("conditions")} placeholder="Asthma, Type-1 diabetes…" rows={2} />
        </div>
        <div>
          <Label htmlFor="mp-contact">Emergency contact</Label>
          <Input id="mp-contact" value={form.emergencyContact} onChange={set("emergencyContact")} placeholder="+91 98XXX XXXXX" autoComplete="tel" />
        </div>
        <div className="mt-1 flex gap-2">
          <Button onClick={save} className="flex-1" aria-label="Generate offline QR medical pass">
            <HeartPulse className="h-4 w-4" /> Generate Pass
          </Button>
          {qrPayload && (
            <Button variant="ghost" size="icon" onClick={regenerate} aria-label="Reset medical pass">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
        {syncing && <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><CloudUpload className="h-3 w-3" /> Mirroring to secure cloud…</p>}
      </div>

      {/* ── pass preview ── */}
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        {qrPayload ? (
          <motion.div
            key={qrPayload}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <div
              ref={qrWrapRef}
              className="rounded-2xl bg-white p-3 shadow-[0_0_50px_-10px_rgba(16,185,129,.5)]"
              aria-label="QR code containing medical profile"
            >
              <QRCodeCanvas value={qrPayload} size={188} bgColor="#ffffff" fgColor="#0a1128" level="M" includeMargin={false} />
            </div>
            <div className="text-center">
              <p className="font-display text-sm font-bold text-emerald-300">{form.name} · {form.bloodGroup}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Offline-ready{savedAt ? ` · saved ${new Date(savedAt).toLocaleTimeString()}` : ""}
              </p>
            </div>
            <Badge variant="green">Scan with any camera app</Badge>
            <div className="flex w-full flex-col gap-2">
              <Button variant="success" size="sm" onClick={downloadQr}>
                <Download className="h-4 w-4" /> Download QR
              </Button>
              <Button variant="secondary" size="sm" onClick={install}>
                <Smartphone className="h-4 w-4" /> Save to Home Screen
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-white/15">
              <HeartPulse className="h-8 w-8 text-slate-600" />
            </div>
            <p className="max-w-[220px] text-xs text-slate-500">
              Fill the form and generate your pass. It encodes blood group, allergies and contacts into a QR that works with zero connectivity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
