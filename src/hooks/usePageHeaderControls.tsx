import { useEffect, type ReactNode } from "react";
import { usePageHeaderDispatch } from "@/contexts/PageSearchContext";

export const usePageHeaderControls = (controls: ReactNode | null) => {
  const { setHeaderControls } = usePageHeaderDispatch();

  useEffect(() => {
    setHeaderControls(controls);
  }, [controls, setHeaderControls]);

  useEffect(() => {
    return () => setHeaderControls(null);
  }, [setHeaderControls]);
};
