
import React, { createContext, useContext, useState, useLayoutEffect, useEffect, useCallback, useMemo, useRef } from "react";
import {
  type Language,
  type LanguagePack,
  LANGUAGE_STORAGE_KEY,
  LANGUAGE_AUTO_KEY,
  getSavedLanguage,
  getStoredLanguage,
  isLanguage,
  getLoadedPack,
  loadLanguagePack,
} from "@/i18n/loader";
import { DEFAULT_APP_SETTINGS } from "@/lib/appSettings";
import { useAppSettings } from "@/contexts/AppSettingsContext";

// Les dictionnaires (fr / ar / en + traductions automatiques) sont chargés à la demande
// depuis src/i18n (un fichier par langue) : seul celui de la langue active est téléchargé.
/** Pack vide si le chargement a définitivement échoué (hors ligne…) : on affiche les clés. */
const EMPTY_PACK: LanguagePack = { dict: {}, translate: (text: string) => text };


interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  getDirection: () => "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Contenus saisis par les utilisateurs (énoncés, éditeurs, formules) : jamais traduits
 * automatiquement. Les libellés de l'interface (y compris ceux des quiz) restent traduits.
 */
const NO_TRANSLATE_SELECTOR = '[data-no-translate], [contenteditable=""], [contenteditable="true"], .ProseMirror, .quiz-question-html, .math-content';
const isInsideNoTranslate = (node: Node | null): boolean => {
  const el = node ? (node.nodeType === 1 ? (node as Element) : node.parentElement) : null;
  if (!el || typeof el.closest !== "function") return false;
  try {
    return !!el.closest(NO_TRANSLATE_SELECTOR);
  } catch {
    return false;
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Langue enregistrée, sinon l'arabe (défaut inchangé)
  const [language, setLanguageState] = useState<Language>(() => getSavedLanguage());
  // Dictionnaire de la langue affichée (null tant qu'il n'est pas chargé)
  const [pack, setPack] = useState<LanguagePack | null>(() => getLoadedPack(getSavedLanguage()));
  const requestedRef = useRef<Language>(language);
  // L'utilisateur a-t-il choisi sa langue ? (sinon : langue par défaut de l'administration)
  const explicitRef = useRef<boolean>(getStoredLanguage() !== null);

  // Premier chargement (déjà lancé à l'évaluation de src/i18n/loader)
  useEffect(() => {
    if (pack) return;
    let alive = true;
    const lang = requestedRef.current;
    loadLanguagePack(lang)
      .then(p => { if (alive && requestedRef.current === lang) setPack(p); })
      .catch(e => {
        console.error("Language pack failed to load:", e);
        if (alive && requestedRef.current === lang) setPack(EMPTY_PACK);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changement de langue instantané, sans rechargement de la page
  // (avant : la page s'affichait traduite, puis se rechargeait et s'affichait une 2e fois).
  // Si le dictionnaire de la nouvelle langue n'est pas encore chargé, l'écran reste dans
  // la langue actuelle le temps du téléchargement (pas de démontage, pas de clignotement).
  const switchLanguage = useCallback((newLang: Language, persist: boolean) => {
    if (persist) {
      explicitRef.current = true;
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
        localStorage.removeItem(LANGUAGE_AUTO_KEY);
      } catch { /* stockage indisponible */ }
    }
    requestedRef.current = newLang;
    const apply = (p: LanguagePack) => {
      if (requestedRef.current !== newLang) return; // une autre langue a été choisie entre-temps
      setPack(p);
      setLanguageState(prev => (prev === newLang ? prev : newLang));
    };
    const ready = getLoadedPack(newLang);
    if (ready) { apply(ready); return; }
    loadLanguagePack(newLang).then(apply).catch(e => {
      console.error("Language pack failed to load:", e);
      apply(EMPTY_PACK);
    });
  }, []);

  // Choix explicite de l'utilisateur : enregistré
  const setLanguage = useCallback((newLang: Language) => switchLanguage(newLang, true), [switchLanguage]);

  // Langue par défaut fixée par l'administration : suivie tant que l'utilisateur n'a rien choisi
  const { settings: appSettings } = useAppSettings();
  useEffect(() => {
    if (appSettings === DEFAULT_APP_SETTINGS) return; // fournisseur absent : défaut d'origine
    if (explicitRef.current || getStoredLanguage()) return;
    const def = appSettings.texts?.defaultLanguage;
    if (isLanguage(def) && def !== requestedRef.current) switchLanguage(def, false);
  }, [appSettings, switchLanguage]);

  // Save language to localStorage and handle RTL and Arabic translation
  // useLayoutEffect : la traduction / restauration du DOM se fait avant l'affichage (pas de flash)
  useLayoutEffect(() => {
    // Langue courante enregistrée (lue directement par d'autres modules) ; marquée « auto »
    // tant que l'utilisateur ne l'a pas choisie, pour que le défaut de l'administration s'applique.
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      if (!explicitRef.current) localStorage.setItem(LANGUAGE_AUTO_KEY, "1");
    } catch { /* stockage indisponible */ }

    // Set the dir attribute on the document for RTL support
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    document.documentElement.setAttribute("translate", "no");
    document.documentElement.classList.add("notranslate");
    
    // Add a class to the body for RTL styling
    if (language === "ar") {
      document.body.classList.add("rtl");
    } else {
      document.body.classList.remove("rtl");
    }

    if (language === "ar" && pack) {
      const translator = pack.translate;
      // Textes d'origine des nœuds traduits, pour pouvoir revenir au français / à l'anglais
      // sans recharger la page.
      const originals = new WeakMap<Node, { original: string; translated: string }>();
      const attrOriginals = new WeakMap<Element, Record<string, { original: string; translated: string }>>();
      const rememberAttr = (el: Element, attr: string, original: string, translated: string) => {
        const rec = attrOriginals.get(el) || {};
        rec[attr] = { original, translated };
        attrOriginals.set(el, rec);
      };

      const translateNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const val = node.nodeValue;
          if (val && val.trim()) {
            const trimmed = val.trim();
            const translated = translator(trimmed);
            if (translated && translated !== trimmed) {
              const next = val.replace(trimmed, translated);
              originals.set(node, { original: val, translated: next });
              node.nodeValue = next;
            }
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"].includes(el.tagName)) return;
          // contenu saisi par l'utilisateur : on ne descend pas dedans
          try {
            if (el.matches && el.matches(NO_TRANSLATE_SELECTOR)) return;
          } catch { /* sélecteur non supporté */ }
          
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            if (el.placeholder) {
              const transPh = translator(el.placeholder);
              if (transPh && transPh !== el.placeholder) {
                rememberAttr(el, "placeholder", el.placeholder, transPh);
                el.placeholder = transPh;
              }
            }
          }
          if (el.title) {
            const transTitle = translator(el.title);
            if (transTitle && transTitle !== el.title) {
              rememberAttr(el, "title", el.title, transTitle);
              el.title = transTitle;
            }
          }
          for (let i = 0; i < el.childNodes.length; i++) {
            translateNode(el.childNodes[i]);
          }
        }
      };

      // Scan initial DOM
      translateNode(document.body);

      // Mutation observer to dynamically translate new elements & texts
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            if (isInsideNoTranslate(mutation.target)) continue;
            mutation.addedNodes.forEach((node) => translateNode(node));
          } else if (mutation.type === "characterData") {
            const node = mutation.target;
            if (isInsideNoTranslate(node)) continue;
            const val = node.nodeValue;
            if (val && val.trim()) {
              const trimmed = val.trim();
              const translated = translator(trimmed);
              if (translated && translated !== trimmed) {
                const next = val.replace(trimmed, translated);
                originals.set(node, { original: val, translated: next });
                node.nodeValue = next;
              }
            }
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      return () => {
        observer.disconnect();
        // Restaurer les textes d'origine encore affichés (React mettra ensuite à jour
        // les textes qui dépendent de la langue).
        try {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
          let n: Node | null = walker.currentNode;
          while (n) {
            if (n.nodeType === Node.TEXT_NODE) {
              const rec = originals.get(n);
              if (rec && n.nodeValue === rec.translated) n.nodeValue = rec.original;
            } else {
              const el = n as HTMLElement;
              const rec = attrOriginals.get(el);
              if (rec) {
                if (rec.title && el.title === rec.title.translated) el.title = rec.title.original;
                if (rec.placeholder && (el as HTMLInputElement).placeholder === rec.placeholder.translated) {
                  (el as HTMLInputElement).placeholder = rec.placeholder.original;
                }
              }
            }
            n = walker.nextNode();
          }
        } catch {
          /* en dernier recours : recharger pour repartir d'un DOM propre */
          window.location.reload();
        }
      };
    }
  }, [language, pack]);

  // Translation function : dictionnaire de la langue, sinon traduction automatique, sinon la clé
  const t = useCallback((key: string): string => {
    if (!pack) return key;
    const v = pack.dict[key];
    if (v) return v;
    const auto = pack.translate(key);
    return auto || key;
  }, [pack]);

  // Get text direction based on language
  const getDirection = useCallback((): "ltr" | "rtl" => {
    return language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t, getDirection }), [language, setLanguage, t, getDirection]);

  // Dictionnaire pas encore prêt (rare : son chargement démarre avant le premier rendu) :
  // même indicateur plein écran que pendant la connexion, plutôt qu'un écran non traduit
  // qui basculerait ensuite en arabe.
  if (!pack) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
