import { useEffect } from "react";
import { usePageSearchDispatch, usePageSearchState } from "@/contexts/PageSearchContext";

type PageSearchOptions = {
  placeholder?: string;
};

export const usePageSearch = (options?: PageSearchOptions) => {
  const context = usePageSearchState();
  const { setPlaceholder, setQuery, setResults } = usePageSearchDispatch();

  useEffect(() => {
    if (options?.placeholder === undefined) return;
    setPlaceholder(options.placeholder);
    return () => {
      setPlaceholder("Search...");
    };
  }, [options?.placeholder, setPlaceholder]);

  return {
    ...context,
    setQuery,
    setResults,
    setPlaceholder,
  };
};
