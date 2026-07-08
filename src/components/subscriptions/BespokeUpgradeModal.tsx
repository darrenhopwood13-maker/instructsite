import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { requestBespokeUpgrade } from "@/lib/subscriptions.functions";
import { FEATURE_LABEL, type FeatureKey } from "@/lib/access";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  feature?: FeatureKey;
  defaultEmail?: string;
  defaultName?: string;
}

export function BespokeUpgradeModal({
  open,
  onClose,
  projectId,
  feature,
  defaultEmail,
  defaultName,
}: Props) {
  const submit = useServerFn(requestBespokeUpgrade);
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setDone(false);
      setMessage("");
      setPhone("");
    } else {
      setName(defaultName ?? "");
      setEmail(defaultEmail ?? "");
    }
  }, [open, defaultEmail, defaultName]);

  if (!open) return null;

  const featureName = feature ? FEATURE_LABEL[feature] : "Apex tier";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setBusy(true);
    try {
      await submit({
        data: {
          projectId,
          featureKey: feature,
          contactName: name.trim(),
          contactEmail: email.trim(),
          contactPhone: phone.trim() || undefined,
          message: message.trim() || undefined,
        },
      });
      setDone(true);
      toast.success("Request received. Our team will be in touch within 1 working day.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A192F]/85 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-[#1E293B] bg-[#0A192F] text-white shadow-[0_20px_60px_-15px_rgba(251,146,60,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[#FB923C] to-transparent" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/60 transition hover:border-[#FB923C] hover:text-[#FB923C]"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="px-8 pb-8 pt-10">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.4em] text-[#FB923C]">
            Apex Tier · Bespoke
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">
            Request Bespoke Upgrade
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            {feature ? (
              <>
                <span className="text-white">{featureName}</span> is an Apex-tier capability. We
                scope Apex deployments per-project — dedicated TAM, ERP bridge, SSO and
                green-mesh verification are configured to your governance model.
              </>
            ) : (
              <>Apex is bespoke — dedicated technical account manager, ERP / COINS bridge,
              enterprise SSO and green-mesh progress verification. We'll scope pricing to
              your project.</>
            )}
          </p>

          {done ? (
            <div className="mt-8 rounded-md border border-[#FB923C]/40 bg-[#FB923C]/10 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FB923C] text-[#0A192F]">
                  <Check size={16} strokeWidth={3} />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest">Request Received</p>
                  <p className="mt-1 text-xs text-white/70">
                    Our team will be in touch within 1 working day.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-md border-2 border-[#FB923C] bg-[#FB923C] px-5 py-3 text-[0.7rem] font-extrabold uppercase tracking-[0.28em] text-[#0A192F] transition hover:brightness-110"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="mt-6 space-y-4">
              <ModalField
                label="Your Name"
                value={name}
                onChange={setName}
                required
                disabled={busy}
              />
              <ModalField
                label="Work Email"
                value={email}
                onChange={setEmail}
                type="email"
                required
                disabled={busy}
              />
              <ModalField
                label="Phone (optional)"
                value={phone}
                onChange={setPhone}
                type="tel"
                disabled={busy}
              />
              <ModalField
                label="What do you need?"
                value={message}
                onChange={setMessage}
                multiline
                disabled={busy}
              />

              <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#1E293B]/60 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/60">
                <ShieldCheck size={12} className="text-[#FB923C]" />
                Encrypted · Only routed to InstructSite sales
              </div>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border-2 border-[#FB923C] bg-[#FB923C] px-5 py-3.5 text-[0.7rem] font-extrabold uppercase tracking-[0.28em] text-[#0A192F] transition hover:brightness-110 disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                {busy ? "Sending…" : "Request Bespoke Quote"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  multiline?: boolean;
}) {
  const cls =
    "mt-1.5 w-full rounded-md border border-white/15 bg-[#1E293B] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#FB923C] focus:outline-none disabled:opacity-50";
  return (
    <label className="block">
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-white/60">
        {label}
        {required && <span className="ml-1 text-[#FB923C]">*</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className={cls}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={cls}
        />
      )}
    </label>
  );
}
