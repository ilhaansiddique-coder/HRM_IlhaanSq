"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, Shield, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { updateProfileAction } from "../actions";

type Initial = {
  fullName: string;
  email: string;
  phone: string;
  roleLabel: string;
  isSuperAdmin: boolean;
};

type FieldErrors = Partial<Record<"fullName" | "email" | "phone", string>>;

export function ProfileForm({ initial }: { initial: Initial }) {
  const [form, setForm] = useState({
    fullName: initial.fullName,
    email: initial.email,
    phone: initial.phone,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const dirty =
    form.fullName !== initial.fullName ||
    form.email !== initial.email ||
    form.phone !== initial.phone;

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!form.fullName.trim()) e.fullName = "Name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = "Please enter a valid email address";
    }
    if (
      form.phone &&
      !/^[\d\s\-+()]{8,}$/.test(form.phone.replace(/\s/g, ""))
    ) {
      e.phone = "Please enter a valid phone number";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    startTransition(async () => {
      const result = await updateProfileAction({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || null,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Profile updated successfully");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Full Name
            </Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              placeholder="Enter your full name"
              className={errors.fullName ? "border-destructive" : ""}
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="you@example.com"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone
            </Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="Enter your phone number"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Role
            </Label>
            <div className="flex h-10 items-center gap-2 px-3">
              <Badge variant="default" className="capitalize">
                {initial.roleLabel}
              </Badge>
              {initial.isSuperAdmin && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  platform
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={pending || !dirty || !form.fullName.trim()}
          className="w-full sm:w-auto"
        >
          {pending ? "Saving…" : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
