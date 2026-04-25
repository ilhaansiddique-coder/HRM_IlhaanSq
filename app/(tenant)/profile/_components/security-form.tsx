"use client";

import { useState, useTransition } from "react";
import { Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { changePasswordAction } from "../actions";

export function SecurityForm() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function handleSubmit() {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    startTransition(async () => {
      const result = await changePasswordAction(
        form.currentPassword,
        form.newPassword
      );
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Password updated successfully");
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(
          [
            { id: "currentPassword", label: "Current Password" },
            { id: "newPassword", label: "New Password" },
            { id: "confirmPassword", label: "Confirm New Password" },
          ] as const
        ).map((f) => (
          <div key={f.id} className="space-y-2">
            <Label htmlFor={f.id}>{f.label}</Label>
            <Input
              id={f.id}
              type="password"
              value={form[f.id]}
              onChange={(e) => set(f.id, e.target.value)}
              placeholder={`Enter ${f.label.toLowerCase()}`}
              autoComplete={
                f.id === "currentPassword" ? "current-password" : "new-password"
              }
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Minimum 8 characters. Your current password is verified before any
          change is saved.
        </p>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Updating…" : "Update Password"}
        </Button>
      </CardContent>
    </Card>
  );
}
