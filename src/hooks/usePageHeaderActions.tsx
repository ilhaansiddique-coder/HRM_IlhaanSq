import { useEffect, type ReactNode } from "react";
import { usePageHeaderDispatch } from "@/contexts/PageSearchContext";

export const usePageHeaderActions = (actions: ReactNode | null) => {
  const { setHeaderActions } = usePageHeaderDispatch();

  useEffect(() => {
    setHeaderActions(actions);
  }, [actions, setHeaderActions]);

  useEffect(() => {
    return () => setHeaderActions(null);
  }, [setHeaderActions]);
};
