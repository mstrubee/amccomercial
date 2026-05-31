import { createContext, useContext, useState, ReactNode } from "react";

export interface ElementoCapturado {
  ruta: string;
  selector: string;
  tagName: string;
  texto: string;
  clases: string;
}

interface NotasModoContextType {
  modoActivo: boolean;
  activarModo: () => void;
  desactivarModo: () => void;
  elementoCapturado: ElementoCapturado | null;
  setElementoCapturado: (e: ElementoCapturado | null) => void;
  panelAbierto: boolean;
  setPanelAbierto: (v: boolean) => void;
}

const NotasModoContext = createContext<NotasModoContextType | null>(null);

export function NotasModoProvider({ children }: { children: ReactNode }) {
  const [modoActivo, setModoActivo] = useState(false);
  const [elementoCapturado, setElementoCapturado] = useState<ElementoCapturado | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);

  return (
    <NotasModoContext.Provider
      value={{
        modoActivo,
        activarModo: () => {
          setModoActivo(true);
          setPanelAbierto(true);
        },
        desactivarModo: () => {
          setModoActivo(false);
          setElementoCapturado(null);
        },
        elementoCapturado,
        setElementoCapturado,
        panelAbierto,
        setPanelAbierto,
      }}
    >
      {children}
    </NotasModoContext.Provider>
  );
}

export function useNotasModo() {
  const ctx = useContext(NotasModoContext);
  if (!ctx) throw new Error("useNotasModo must be used within NotasModoProvider");
  return ctx;
}
