import { redirect } from "next/navigation";

// Salary Structure has moved into Settings (a "Salary Structure" tab). This old
// route now redirects there so any saved links keep working.
export default function StructuresRedirect() {
  redirect("/settings");
}
