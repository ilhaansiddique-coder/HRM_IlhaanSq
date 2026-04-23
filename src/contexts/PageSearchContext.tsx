import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useLocation } from "react-router-dom";

export type PageSearchResultType = "product" | "customer" | "sale" | "invoice";

export type PageSearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
  query?: string;
  type: PageSearchResultType;
};

type PageSearchStateValue = {
  query: string;
  placeholder: string;
  results: PageSearchResult[];
};

type PageSearchDispatchValue = {
  setQuery: (value: string) => void;
  setPlaceholder: (value: string) => void;
  setResults: Dispatch<SetStateAction<PageSearchResult[]>>;
};

type PageHeaderStateValue = {
  headerControls: ReactNode | null;
  headerActions: ReactNode | null;
};

type PageHeaderDispatchValue = {
  setHeaderControls: (value: ReactNode | null) => void;
  setHeaderActions: (value: ReactNode | null) => void;
};

const PageSearchStateContext = createContext<PageSearchStateValue | null>(null);
const PageSearchDispatchContext = createContext<PageSearchDispatchValue | null>(null);
const PageHeaderStateContext = createContext<PageHeaderStateValue | null>(null);
const PageHeaderDispatchContext = createContext<PageHeaderDispatchValue | null>(null);

export const PageSearchProvider = ({ children }: { children: ReactNode }) => {
  const [query, setQuery] = useState("");
  const [placeholder, setPlaceholder] = useState("Search...");
  const [results, setResults] = useState<PageSearchResult[]>([]);
  const [headerControls, setHeaderControls] = useState<ReactNode | null>(null);
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);
  const location = useLocation();

  const setHeaderControlsValue = useCallback((value: ReactNode | null) => {
    setHeaderControls((prev) => (Object.is(prev, value) ? prev : value));
  }, []);

  const setHeaderActionsValue = useCallback((value: ReactNode | null) => {
    setHeaderActions((prev) => (Object.is(prev, value) ? prev : value));
  }, []);

  useEffect(() => {
    setQuery("");
    setResults([]);
  }, [location.pathname, location.search]);

  const searchState = useMemo(
    () => ({
      query,
      placeholder,
      results,
    }),
    [query, placeholder, results],
  );

  const searchDispatch = useMemo(
    () => ({
      setQuery,
      setPlaceholder,
      setResults,
    }),
    [],
  );

  const headerState = useMemo(
    () => ({
      headerControls,
      headerActions,
    }),
    [headerControls, headerActions],
  );

  const headerDispatch = useMemo(
    () => ({
      setHeaderControls: setHeaderControlsValue,
      setHeaderActions: setHeaderActionsValue,
    }),
    [setHeaderControlsValue, setHeaderActionsValue],
  );

  return (
    <PageSearchDispatchContext.Provider value={searchDispatch}>
      <PageHeaderDispatchContext.Provider value={headerDispatch}>
        <PageSearchStateContext.Provider value={searchState}>
          <PageHeaderStateContext.Provider value={headerState}>
            {children}
          </PageHeaderStateContext.Provider>
        </PageSearchStateContext.Provider>
      </PageHeaderDispatchContext.Provider>
    </PageSearchDispatchContext.Provider>
  );
};

export const usePageSearchState = () => {
  const context = useContext(PageSearchStateContext);
  if (!context) {
    throw new Error("usePageSearchState must be used within a PageSearchProvider.");
  }
  return context;
};

export const usePageSearchDispatch = () => {
  const context = useContext(PageSearchDispatchContext);
  if (!context) {
    throw new Error("usePageSearchDispatch must be used within a PageSearchProvider.");
  }
  return context;
};

export const usePageHeaderState = () => {
  const context = useContext(PageHeaderStateContext);
  if (!context) {
    throw new Error("usePageHeaderState must be used within a PageSearchProvider.");
  }
  return context;
};

export const usePageHeaderDispatch = () => {
  const context = useContext(PageHeaderDispatchContext);
  if (!context) {
    throw new Error("usePageHeaderDispatch must be used within a PageSearchProvider.");
  }
  return context;
};
