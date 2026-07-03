import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** When this value changes, the boundary resets (e.g. pass the route path). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle exceptions in its subtree and shows a recoverable
 * fallback instead of unmounting the whole React tree (which would blank the
 * entire page). React only supports class components as error boundaries.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    // Auto-recover when the reset key changes (e.g. the user navigates away).
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the real stack in devtools for diagnosis.
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 px-6 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Ocurrió un error</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              No se pudo mostrar esta sección. Puedes intentar nuevamente o recargar la página.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleReset}>
              Volver
            </Button>
            <Button onClick={() => window.location.reload()}>Recargar</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
