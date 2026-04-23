import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatPackageLimit,
  requestedPackageDefinitions,
  requestedPackageOrder,
  type RequestedPackage,
} from "@/constants/packagePlans";

const requiredTrimmed = (label: string, minLength = 1) =>
  z.string().trim().min(minLength, `${label} is required`);

export type DemoRequestPackage = RequestedPackage;

const schema = z.object({
  full_name: requiredTrimmed("Full name", 2),
  business_name: requiredTrimmed("Business name", 2),
  requested_domain: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^[a-z0-9-]+$/.test(value),
      "Use lowercase letters, numbers and hyphen only"
    ),
  email: z.string().trim().min(1, "Email is required").email("Valid email is required"),
  phone: z.string().trim().min(5, "Phone is required"),
  business_type: z.enum(["Wholesale", "Retail", "Distribution", "Manufacturing", "Other"]),
  requested_package: z.enum(["starter", "professional", "enterprise"]),
  message: z.string().trim().optional(),
});

type DemoRequestForm = z.infer<typeof schema>;
type ContactFieldName = "email" | "phone";

interface DemoSignupResponse {
  success?: boolean;
  error?: string;
  field_errors?: Partial<Record<ContactFieldName, string>>;
  request_notification_status?: "pending" | "sent" | "failed" | "skipped";
  request_notification_error?: string | null;
}

interface DemoRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRequestedPackage?: RequestedPackage;
}

const buildDefaultValues = (requestedPackage: RequestedPackage): DemoRequestForm => ({
  full_name: "",
  business_name: "",
  requested_domain: "",
  email: "",
  phone: "",
  business_type: "Wholesale",
  requested_package: requestedPackage,
  message: "",
});

const formatNotificationError = (value: string | null | undefined): string => {
  if (!value) {
    return "Request submitted, but verification email was not sent. Please contact support.";
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("domain is not verified")) {
    return "Request submitted. Legacy email-provider error detected on this request record. Please retry after deploying latest functions.";
  }
  if (normalized.includes("supabase_anon_key")) {
    return "Request submitted, but verification email is not configured on the server (missing SUPABASE_ANON_KEY).";
  }

  return value;
};

export const DemoRequestModal = ({
  open,
  onOpenChange,
  initialRequestedPackage = "starter",
}: DemoRequestModalProps) => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const form = useForm<DemoRequestForm>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: buildDefaultValues(initialRequestedPackage),
  });

  useEffect(() => {
    if (!open || isSubmitted) return;
    form.setValue("requested_package", initialRequestedPackage, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [form, initialRequestedPackage, isSubmitted, open]);

  const clearDuplicateError = (fieldName: ContactFieldName) => {
    if (form.getFieldState(fieldName).error?.type === "duplicate") {
      form.clearErrors(fieldName);
    }
  };

  const applyDuplicateErrors = (fieldErrors?: Partial<Record<ContactFieldName, string>>) => {
    const emailError = fieldErrors?.email;
    const phoneError = fieldErrors?.phone;

    if (emailError) {
      form.setError("email", { type: "duplicate", message: emailError });
    } else {
      clearDuplicateError("email");
    }

    if (phoneError) {
      form.setError("phone", { type: "duplicate", message: phoneError });
    } else {
      clearDuplicateError("phone");
    }
  };

  const normalizeSubmitValues = (values: DemoRequestForm): DemoRequestForm => ({
    ...values,
    full_name: values.full_name.trim(),
    business_name: values.business_name.trim(),
    requested_domain: values.requested_domain?.trim() ?? "",
    email: values.email.trim(),
    phone: values.phone.trim(),
    requested_package: values.requested_package,
    message: values.message?.trim() ?? "",
  });

  const validateUniqueContacts = async (
    fields: ContactFieldName[],
    values?: DemoRequestForm,
  ) => {
    const currentValues = values ?? form.getValues();
    const payload: {
      action: "validate_request_contact";
      email?: string;
      phone?: string;
    } = {
      action: "validate_request_contact",
    };

    if (fields.includes("email")) {
      const email = currentValues.email.trim().toLowerCase();
      if (email) {
        payload.email = email;
      } else {
        clearDuplicateError("email");
      }
    }

    if (fields.includes("phone")) {
      const phone = currentValues.phone.trim();
      if (phone) {
        payload.phone = phone;
      } else {
        clearDuplicateError("phone");
      }
    }

    if (!payload.email && !payload.phone) {
      return true;
    }

    const { data, error } = await supabase.functions.invoke("demo-signup", {
      body: payload,
    });

    if (error) {
      throw error;
    }

    const response = (data ?? {}) as DemoSignupResponse;
    applyDuplicateErrors(response.field_errors);

    if (response.field_errors?.email) {
      toast.error(response.field_errors.email);
    }

    if (response.field_errors?.phone) {
      toast.error(response.field_errors.phone);
    }

    return !response.field_errors?.email && !response.field_errors?.phone;
  };

  const handleUniqueFieldBlur = async (fieldName: ContactFieldName) => {
    const isValid = await form.trigger(fieldName);
    if (!isValid) return;

    try {
      await validateUniqueContacts([fieldName]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to validate field";
      toast.error(message);
    }
  };

  const onSubmit = async (values: DemoRequestForm) => {
    try {
      const normalizedValues = normalizeSubmitValues(values);
      const hasUniqueContacts = await validateUniqueContacts(["email", "phone"], normalizedValues);
      if (!hasUniqueContacts) {
        return;
      }

      const { data, error } = await supabase.functions.invoke("demo-signup", {
        body: {
          action: "request_demo",
          ...normalizedValues,
        },
      });

      if (error) throw error;
      const response = (data ?? {}) as DemoSignupResponse;
      if (response.success === false) {
        applyDuplicateErrors(response.field_errors);
        if (response.field_errors?.email || response.field_errors?.phone) {
          return;
        }

        if (response.error === "Missing required fields") {
          if (!normalizedValues.full_name) {
            form.setError("full_name", { type: "server", message: "Full name is required" });
          }
          if (!normalizedValues.business_name) {
            form.setError("business_name", { type: "server", message: "Business name is required" });
          }
          if (!normalizedValues.email) {
            form.setError("email", { type: "server", message: "Email is required" });
          }
          if (!normalizedValues.phone) {
            form.setError("phone", { type: "server", message: "Phone is required" });
          }
          return;
        }

        if (response.error === "Invalid email address") {
          form.setError("email", { type: "server", message: "Valid email is required" });
          return;
        }

        // Keep request flow non-blocking when email delivery fails.
        if (
          typeof response.error === "string" &&
          (
            response.error.toLowerCase().includes("verification send failed") ||
            response.error.toLowerCase().includes("email delivery failed") ||
            response.error.toLowerCase().includes("domain is not verified")
          )
        ) {
          setIsSubmitted(true);
          toast.warning(
            formatNotificationError(response.error)
          );
          return;
        }

        throw new Error(response.error || "Failed to submit request");
      }

      setIsSubmitted(true);
      if (
        response.request_notification_status &&
        response.request_notification_status !== "sent"
      ) {
        toast.warning(
          formatNotificationError(response.request_notification_error),
        );
      } else {
        toast.success("Demo request submitted");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit request";
      toast.error(message);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setIsSubmitted(false);
      form.reset(buildDefaultValues(initialRequestedPackage));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply for Registration</DialogTitle>
          <DialogDescription>
            Share your business details, selected package, and preferred domain. The superadmin will review the request and provision your admin account after approval.
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="rounded-md border bg-muted/30 p-6 text-center">
            <h3 className="text-lg font-semibold">Request received</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The superadmin will review your admin request and contact you with the approved login details.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="business_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="requested_domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requested Domain (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="your-business" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Example: <span className="font-mono">your-business.example.com</span>
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          className={fieldState.error ? "input-error border-destructive" : undefined}
                          onChange={(event) => {
                            clearDuplicateError("email");
                            field.onChange(event);
                          }}
                          onBlur={async () => {
                            field.onBlur();
                            await handleUniqueFieldBlur("email");
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className={fieldState.error ? "input-error border-destructive" : undefined}
                          onChange={(event) => {
                            clearDuplicateError("phone");
                            field.onChange(event);
                          }}
                          onBlur={async () => {
                            field.onBlur();
                            await handleUniqueFieldBlur("phone");
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="requested_package"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested Package</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select package" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {requestedPackageOrder.map((packageKey) => (
                            <SelectItem key={packageKey} value={packageKey}>
                              {requestedPackageDefinitions[packageKey].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">
                          {requestedPackageDefinitions[field.value].label} ·{" "}
                          {requestedPackageDefinitions[field.value].priceLabel}
                        </p>
                        <p className="mt-1">
                          {requestedPackageDefinitions[field.value].modalDescription}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-border/70 px-2 py-1">
                            {formatPackageLimit(
                              requestedPackageDefinitions[field.value].usageLimits.products,
                              "products",
                            )}
                          </span>
                          <span className="rounded-full border border-border/70 px-2 py-1">
                            {formatPackageLimit(
                              requestedPackageDefinitions[field.value].usageLimits.customers,
                              "customers",
                            )}
                          </span>
                          <span className="rounded-full border border-border/70 px-2 py-1">
                            {formatPackageLimit(
                              requestedPackageDefinitions[field.value].usageLimits.sales,
                              "sales",
                            )}
                          </span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="business_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Wholesale">Wholesale</SelectItem>
                          <SelectItem value="Retail">Retail</SelectItem>
                          <SelectItem value="Distribution">Distribution</SelectItem>
                          <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
