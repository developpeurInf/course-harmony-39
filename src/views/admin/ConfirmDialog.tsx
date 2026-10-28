import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "./adminShared";

/** Options d'une demande de confirmation (remplace confirm() / prompt()) */
export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** champ texte facultatif (ex. motif de suspension) */
  input?: { label: string; placeholder?: string; defaultValue?: string; multiline?: boolean; required?: boolean };
  /** action exécutée à la confirmation ; renvoyer false garde la fenêtre ouverte */
  onConfirm: (value: string) => unknown | Promise<unknown>;
}

let uid = 0;

export function ConfirmDialog({ options, onClose }: { options: ConfirmOptions | null; onClose: () => void }) {
  const { L } = useT();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef(`confirm-input-${++uid}`);
  const last = useRef<ConfirmOptions | null>(null);
  if (options) last.current = options;
  const o = options || last.current; // garde le contenu pendant l'animation de fermeture

  useEffect(() => {
    if (options) {
      setValue(options.input?.defaultValue || "");
      setBusy(false);
    }
  }, [options]);

  if (!o) return null;
  const blocked = !!o.input?.required && !value.trim();

  const run = async () => {
    if (busy || blocked) return;
    setBusy(true);
    let keepOpen = false;
    try {
      keepOpen = (await o.onConfirm(value.trim())) === false;
    } finally {
      setBusy(false);
    }
    if (!keepOpen) onClose();
  };

  return (
    <AlertDialog open={!!options} onOpenChange={v => !v && !busy && onClose()}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg">
        <AlertDialogHeader className="sm:text-start">
          <AlertDialogTitle className={o.destructive ? "text-red-600" : undefined}>{o.title}</AlertDialogTitle>
          {o.description ? <AlertDialogDescription>{o.description}</AlertDialogDescription> : <AlertDialogDescription className="sr-only">{o.title}</AlertDialogDescription>}
        </AlertDialogHeader>
        {o.input && (
          <div className="space-y-1.5">
            <Label htmlFor={idRef.current}>{o.input.label}</Label>
            {o.input.multiline ? (
              <Textarea id={idRef.current} rows={3} value={value} placeholder={o.input.placeholder} disabled={busy} onChange={e => setValue(e.target.value)} />
            ) : (
              <Input
                id={idRef.current}
                value={value}
                placeholder={o.input.placeholder}
                disabled={busy}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void run();
                  }
                }}
              />
            )}
          </div>
        )}
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {o.cancelLabel || L("Annuler", "إلغاء", "Cancel")}
          </Button>
          <Button
            type="button"
            disabled={busy || blocked}
            onClick={run}
            className={o.destructive ? "bg-red-600 text-white hover:bg-red-700" : undefined}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {o.confirmLabel || L("Confirmer", "تأكيد", "Confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** const { ask, dialog } = useConfirm(); … ask({ title, onConfirm }) ; rendre {dialog} dans le composant */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const ask = useCallback((o: ConfirmOptions) => setOptions(o), []);
  const close = useCallback(() => setOptions(null), []);
  const dialog = <ConfirmDialog options={options} onClose={close} />;
  return { ask, dialog, close };
}
