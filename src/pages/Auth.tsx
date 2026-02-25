import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import logoAmc from "@/assets/logo-amc.png";
import { useThemeSettings } from "@/hooks/useThemeSettings";

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(1, "Contraseña requerida").max(128),
});

interface Props {
  onLogin: (email: string, password: string) => Promise<{ error: any }>;
}

export default function Auth({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: theme } = useThemeSettings();
  const logoSrc = theme?.theme_company_logo || logoAmc;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    const { error } = await onLogin(parsed.data.email, parsed.data.password);
    setLoading(false);
    if (error) {
      if (error.message?.includes("Invalid login")) {
        toast.error("Credenciales incorrectas");
      } else {
        toast.error(error.message || "Error al iniciar sesión");
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <img src={logoSrc} alt="Logo" className="mx-auto w-12 h-12 rounded-xl object-cover mb-4" />
          <h1 className="text-2xl font-bold text-foreground">AMC</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestión Comercial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-xl border border-border shadow-sm">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@empresa.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Iniciar Sesión
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
