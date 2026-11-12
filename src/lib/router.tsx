"use client";

/**
 * Navigation de l'application, construite sur le routeur de Next.js (App Router).
 *
 * Expose les mêmes noms que react-router (Link, NavLink, Navigate, useNavigate,
 * useLocation, useParams) pour que les pages n'aient pas à connaître le routeur.
 * L'« état » de navigation (ex. page d'origine avant la connexion) est gardé en
 * mémoire le temps d'une navigation.
 */
import * as React from "react";
import NextLink from "next/link";
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from "next/navigation";

type To = string | { pathname?: string; search?: string; hash?: string };

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

let pendingState: unknown = null;

const toHref = (to: To): string => {
  if (typeof to === "string") return to;
  return `${to.pathname ?? ""}${to.search ?? ""}${to.hash ?? ""}`;
};

export function useNavigate() {
  const router = useRouter();
  return React.useCallback(
    (to: To | number, options: NavigateOptions = {}) => {
      if (typeof to === "number") {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      pendingState = options.state ?? null;
      const href = toHref(to);
      if (options.replace) router.replace(href);
      else router.push(href);
    },
    [router],
  );
}

export function useLocation() {
  const pathname = usePathname() ?? "/";
  const searchParams = useNextSearchParams();
  const qs = searchParams?.toString() ?? "";
  const [hash, setHash] = React.useState("");
  React.useEffect(() => {
    setHash(window.location.hash);
  }, [pathname, qs]);
  return React.useMemo(
    () => ({ pathname, search: qs ? `?${qs}` : "", hash, state: pendingState, key: pathname + qs }),
    [pathname, qs, hash],
  );
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const params = useNextParams() ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) out[k] = Array.isArray(v) ? v.join("/") : (v as string);
  return out as T;
}

export function useSearchParams() {
  return useNextSearchParams();
}

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: To;
  replace?: boolean;
  state?: unknown;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, onClick, ...rest },
  ref,
) {
  return (
    <NextLink
      ref={ref}
      href={toHref(to)}
      replace={replace}
      onClick={(e) => {
        pendingState = state ?? null;
        onClick?.(e);
      }}
      {...rest}
    />
  );
});

type NavLinkProps = Omit<LinkProps, "className" | "children" | "style"> & {
  end?: boolean;
  className?: string | ((s: { isActive: boolean }) => string | undefined);
  style?: React.CSSProperties | ((s: { isActive: boolean }) => React.CSSProperties | undefined);
  children?: React.ReactNode | ((s: { isActive: boolean }) => React.ReactNode);
};

export function isPathActive(pathname: string, target: string, end = false) {
  const clean = target.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  if (end || clean === "/") return pathname === clean;
  return pathname === clean || pathname.startsWith(clean + "/");
}

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { to, end, className, style, children, ...rest },
  ref,
) {
  const pathname = usePathname() ?? "/";
  const isActive = isPathActive(pathname, toHref(to), end);
  return (
    <Link
      ref={ref}
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={typeof className === "function" ? className({ isActive }) : className}
      style={typeof style === "function" ? style({ isActive }) : style}
      {...rest}
    >
      {typeof children === "function" ? children({ isActive }) : children}
    </Link>
  );
});

export function Navigate({ to, replace = true, state }: { to: To; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, to, replace, state]);
  return null;
}
