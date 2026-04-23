import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DemoRequestModal } from "@/components/landing/DemoRequestModal";

const DemoRequestPage = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Request for demo</h1>
        <p className="text-muted-foreground">Share your business details and the superadmin will review your tenant admin request.</p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => setOpen(true)}>Open Form</Button>
          <Button variant="outline" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
      <DemoRequestModal open={open} onOpenChange={setOpen} />
    </div>
  );
};

export default DemoRequestPage;
