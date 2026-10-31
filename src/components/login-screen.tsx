import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Container as ContainerIcon, LayoutGrid, LogIn } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/api";
import { setRole } from "@/lib/role";
import { logAction } from "@/lib/session";

export function LoginScreen() {
  const { data: centres = [] } = useQuery({ queryKey: ["centres"], queryFn: api.centres });
  const [subject, setSubject] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await api.verifyLogin(subject, password);
      if (!ok) {
        toast.error("Wrong password. Please try again.");
        return;
      }
      const centre = centres.find((c) => c.id === subject);
      logAction(centre?.id ?? null, centre?.name ?? null, "Logged in", centre ? `Centre user · ${centre.name}` : "Admin");
      setRole(subject === "admin" ? { kind: "master" } : { kind: "centre", centreId: subject });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute left-4 top-4">
        <Button asChild size="sm" variant="outline">
          <Link to="/">
            <LayoutGrid className="mr-1.5 size-4" /> Switch module
          </Link>
        </Button>
      </div>
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form onSubmit={login} className="panel w-full max-w-sm space-y-5 p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ContainerIcon className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold">Container Yard Manager</h1>
            <p className="text-xs text-muted-foreground">Sign in to continue</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Login as</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger aria-label="Login as">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              {centres.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  Centre User · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw" className="text-xs text-muted-foreground">Password</Label>
          <Input id="pw" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy || !password}>
          <LogIn className="mr-2 size-4" /> Login
        </Button>
      </form>
    </div>
  );
}
