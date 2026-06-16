"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Plus, SquarePen, Trash2, ExternalLink } from "lucide-react";
import { PERMISSION_CATEGORIES, ROLES } from "@/lib/permissions";
import {
  createUserAction,
  deleteUserAction,
  togglePermissionAction,
  updateUserAction,
} from "../actions";

const roleColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  owner: "default",
  admin: "default",
  manager: "secondary",
  staff: "outline",
  member: "outline",
};


export function UsersTab({
  users,
  currentUserId,
  rolePermissions,
}: {
  users: any[];
  currentUserId: string;
  rolePermissions: Record<string, Record<string, boolean>>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("staff");

  // Helper: is this permission allowed for the currently selected role?
  const isAllowed = (permKey: string): boolean =>
    rolePermissions[selectedRole]?.[permKey] ?? false;

  const columns: Column<any>[] = [
    {
      key: "user",
      header: "User",
      className: "font-medium",
      cell: (m) => (
        <>
          {m.user.fullName}
          {m.userId === currentUserId && (
            <span className="text-xs text-muted-foreground ml-2">(you)</span>
          )}
        </>
      ),
    },
    {
      key: "email",
      header: "Email",
      className: "text-muted-foreground text-xs",
      cell: (m) => m.user.email,
    },
    {
      key: "phone",
      header: "Phone",
      className: "text-muted-foreground text-xs",
      cell: (m) => m.user.phone ?? "-",
    },
    {
      key: "role",
      header: "Role",
      cell: (m) => (
        <Badge variant={roleColors[m.role] ?? "outline"}>{m.role}</Badge>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      className: "text-xs text-muted-foreground",
      cell: (m) => new Date(m.user.createdAt).toLocaleDateString(),
    },
    {
      key: "lastActive",
      header: "Last Active",
      className: "text-xs text-muted-foreground",
      cell: (m) =>
        m.user.lastSignInAt
          ? new Date(m.user.lastSignInAt).toLocaleDateString()
          : "Never",
    },
  ];

  return (
    <div className="space-y-6">
      {/* User Management */}
      {/* Desktop: table view. Mobile uses the card stack below. */}
      <div className="hidden md:block space-y-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <p className="text-base font-semibold">User Management</p>
            <p className="text-sm text-muted-foreground">
              Create and manage user accounts
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>
        <DataTable
          rows={users}
          columns={columns}
          getId={(m) => m.id}
          selectable={false}
          itemNoun="users"
          actionsCell={(m) => {
            const isMe = m.userId === currentUserId;
            return (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="View">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setEditing(m)}
                  title="Edit"
                >
                  <SquarePen className="h-3.5 w-3.5" />
                </Button>
                {!isMe && (
                  <form action={deleteUserAction} className="inline-block">
                    <input type="hidden" name="userId" value={m.userId} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-destructive/70 hover:text-destructive"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                )}
              </>
            );
          }}
        />
      </div>

      {/* Mobile: same data as a card stack — name + role header, email and
          phone, two-col joined/last-active grid, then action buttons. */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold">User Management</p>
            <p className="text-xs text-muted-foreground">
              Create and manage user accounts
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        {users.map((m) => {
          const isMe = m.userId === currentUserId;
          return (
            <Card key={m.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">
                    {m.user.fullName}
                    {isMe && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 break-all text-xs text-muted-foreground">
                    {m.user.email}
                  </p>
                  {m.user.phone && (
                    <p className="text-xs text-muted-foreground">
                      {m.user.phone}
                    </p>
                  )}
                </div>
                <Badge
                  variant={roleColors[m.role] ?? "outline"}
                  className="rounded-lg"
                >
                  {m.role}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Joined: </span>
                  <span className="font-medium">
                    {new Date(m.user.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Last active: </span>
                  <span className="font-medium">
                    {m.user.lastSignInAt
                      ? new Date(m.user.lastSignInAt).toLocaleDateString()
                      : "Never"}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg"
                  title="View"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={() => setEditing(m)}
                  title="Edit"
                >
                  <SquarePen className="h-3.5 w-3.5" />
                  Edit
                </Button>
                {!isMe && (
                  <form action={deleteUserAction} className="flex-1">
                    <input type="hidden" name="userId" value={m.userId} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="w-full rounded-lg text-destructive hover:text-destructive"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </form>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Permissions Matrix */}
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>User Role Permission Management</CardTitle>
            <CardDescription>Control which features each role can access</CardDescription>
          </div>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general">
            <TabsList className="flex w-full overflow-x-auto justify-start">
              {Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => (
                <TabsTrigger key={key} value={key} className="text-xs whitespace-nowrap">
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => (
              <TabsContent key={key} value={key} className="mt-4 space-y-2">
                {cat.permissions.map((perm) => (
                  <PermissionRow
                    // Force remount when role changes so the toggle reflects the new role's saved value
                    key={`${selectedRole}-${perm.key}`}
                    role={selectedRole}
                    permission={perm}
                    initialAllowed={isAllowed(perm.key)}
                  />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account for this workspace</DialogDescription>
          </DialogHeader>
          <form
            action={async (fd) => {
              await createUserAction(fd);
              setAddOpen(false);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" name="fullName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue="staff">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== "owner").map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create User</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {editing.user.fullName}</DialogTitle>
              <DialogDescription>Update user details or reset password</DialogDescription>
            </DialogHeader>
            <form
              action={async (fd) => {
                await updateUserAction(fd);
                setEditing(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="userId" value={editing.userId} />
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  defaultValue={editing.user.fullName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={editing.user.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New Password (leave blank to keep current)</Label>
                <Input id="password" name="password" type="password" minLength={6} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PermissionRow({
  role,
  permission,
  initialAllowed,
}: {
  role: string;
  permission: { key: string; label: string };
  initialAllowed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialAllowed);

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    const fd = new FormData();
    fd.set("role", role);
    fd.set("permissionKey", permission.key);
    fd.set("allowed", String(checked));
    startTransition(async () => {
      try {
        await togglePermissionAction(fd);
      } catch (e) {
        // Roll back UI on failure
        setEnabled(!checked);
        alert(e instanceof Error ? e.message : "Failed to save permission");
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-3">
      <span className="text-sm font-medium">{permission.label}</span>
      <Switch checked={enabled} onCheckedChange={handleToggle} disabled={pending} />
    </div>
  );
}

