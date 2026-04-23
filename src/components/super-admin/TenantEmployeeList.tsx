import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getTenantEmployees,
  getTenants,
  tenantManagementQueryKeys,
  type TenantEmployeeRecord,
} from "@/services/tenantService";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

export interface TenantEmployeeListProps {
  initialTenantId?: string;
}

export function TenantEmployeeList({ initialTenantId }: TenantEmployeeListProps) {
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenantId ?? "");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const tenantsQuery = useQuery({
    queryKey: tenantManagementQueryKeys.tenants,
    queryFn: getTenants,
  });

  useEffect(() => {
    if (selectedTenantId || !tenantsQuery.data?.length) {
      return;
    }

    setSelectedTenantId(initialTenantId ?? tenantsQuery.data[0].id);
  }, [initialTenantId, selectedTenantId, tenantsQuery.data]);

  const employeesQuery = useQuery({
    queryKey: tenantManagementQueryKeys.employees(selectedTenantId),
    queryFn: () => getTenantEmployees(selectedTenantId),
    enabled: Boolean(selectedTenantId),
  });

  const roleOptions = useMemo(() => {
    const uniqueRoles = new Set((employeesQuery.data ?? []).map((employee) => employee.role));
    return Array.from(uniqueRoles).sort((left, right) => left.localeCompare(right));
  }, [employeesQuery.data]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const source = employeesQuery.data ?? [];

    return source.filter((employee) => {
      const matchesSearch =
        !normalizedSearch ||
        employee.name.toLowerCase().includes(normalizedSearch) ||
        employee.role.toLowerCase().includes(normalizedSearch) ||
        employee.status.toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === "all" || employee.role === roleFilter;
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employeesQuery.data, roleFilter, searchTerm, statusFilter]);

  const selectedTenantName =
    tenantsQuery.data?.find((tenant) => tenant.id === selectedTenantId)?.tenant_name ?? "Selected Tenant";

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <CardTitle>Tenant Employees</CardTitle>
          <CardDescription>Choose a tenant and filter its employee directory by name, role, or status.</CardDescription>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-employee-tenant">Tenant</Label>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger id="tenant-employee-tenant">
                <SelectValue placeholder="Select a tenant" />
              </SelectTrigger>
              <SelectContent>
                {(tenantsQuery.data ?? []).map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.tenant_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="tenant-employee-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="tenant-employee-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, role, or status"
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-employee-role-filter">Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger id="tenant-employee-role-filter">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-employee-status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="tenant-employee-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!selectedTenantId ? (
          <p className="text-sm text-muted-foreground">Select a tenant to view its employees.</p>
        ) : employeesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading employees for {selectedTenantName}...</p>
        ) : employeesQuery.error ? (
          <p className="text-sm text-destructive">
            Failed to load employees: {(employeesQuery.error as Error).message}
          </p>
        ) : filteredEmployees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employees match the current search and filters.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredEmployees.length} employee{filteredEmployees.length === 1 ? "" : "s"} for{" "}
                <span className="font-medium text-foreground">{selectedTenantName}</span>
              </p>
              <Badge variant="outline">{selectedTenantId}</Badge>
            </div>

            <div className="grid gap-3 md:hidden">
              {filteredEmployees.map((employee: TenantEmployeeRecord) => (
                <div key={employee.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{employee.name}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{employee.email}</p>
                    </div>
                    <Badge variant={employee.status === "active" ? "default" : "secondary"}>
                      {employee.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Role</span>
                      <span>{employee.role}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Joined</span>
                      <span>{formatDate(employee.joined_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee: TenantEmployeeRecord) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell>
                        <Badge variant={employee.status === "active" ? "default" : "secondary"}>
                          {employee.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(employee.joined_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default TenantEmployeeList;
