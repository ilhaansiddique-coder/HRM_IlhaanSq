import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, UserPlus, Shield, CheckCircle } from "lucide-react";
import { useFirstTimeSetup } from "@/hooks/useFirstTimeSetup";
import { toast } from "@/utils/toast";

interface SetupFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FirstTimeSetupProps {
  children: React.ReactNode;
}

export function FirstTimeSetup({ children }: FirstTimeSetupProps) {
  const [formData, setFormFormData] = useState<SetupFormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [isSettingUp] = useState(false);
  const [step] = useState<'form' | 'creating' | 'success'>('form');
  const { isFirstTime, isLoading } = useFirstTimeSetup();

  // If not first time setup, render children normally
  if (!isFirstTime && !isLoading) {
    return <>{children}</>;
  }

  // If still loading, show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-info/12 dark:bg-info/20 rounded-full">
              <Shield className="h-8 w-8 text-info dark:text-info" />
            </div>
            <CardTitle className="text-xl">Checking Setup Status</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-base-100 rounded w-3/4 mx-auto mb-2"></div>
              <div className="h-4 bg-base-100 rounded w-1/2 mx-auto"></div>
            </div>
            <p className="text-sm text-muted-foreground">
              Verifying your application setup...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleInputChange = (field: keyof SetupFormData, value: string) => {
    setFormFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.fullName.trim()) return "Full name is required";
    if (!formData.email.trim()) return "Email is required";
    if (!formData.email.includes('@')) return "Please enter a valid email";
    if (formData.password.length < 6) return "Password must be at least 6 characters";
    if (formData.password !== formData.confirmPassword) return "Passwords do not match";
    return null;
  };

  const handleSetup = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    toast.error("First-time self-setup is disabled. Ask the superadmin to provision access.");
  };

  if (step === 'creating') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-info/12 dark:bg-info/20 rounded-full">
              <Shield className="h-8 w-8 text-info dark:text-info" />
            </div>
            <CardTitle className="text-xl">Setting Up Admin Account</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-base-100 rounded w-3/4 mx-auto mb-2"></div>
              <div className="h-4 bg-base-100 rounded w-1/2 mx-auto"></div>
            </div>
            <p className="text-sm text-muted-foreground">
              Creating your admin account and configuring permissions...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-success/12 dark:bg-success/20 rounded-full">
              <CheckCircle className="h-8 w-8 text-success dark:text-success" />
            </div>
            <CardTitle className="text-xl">Setup Complete!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Your admin account has been created successfully. 
              The app will refresh automatically to complete the setup.
            </p>
            <div className="animate-spin mx-auto">
              <div className="h-6 w-6 border-2 border-info/50 border-t-transparent rounded-full"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-info/12 to-secondary/12 dark:from-base-300 dark:to-base-300">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-info/12 dark:bg-info/20 rounded-full">
            <UserPlus className="h-8 w-8 text-info dark:text-info" />
          </div>
          <CardTitle className="text-2xl">Welcome to Your App!</CardTitle>
          <p className="text-sm text-muted-foreground">
            This appears to be your first time setting up the application. 
            Let's create your admin account to get started.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              disabled={isSettingUp}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={isSettingUp}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              disabled={isSettingUp}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              disabled={isSettingUp}
            />
          </div>

          <div className="bg-info/12 dark:bg-info/20 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-info dark:text-info mt-0.5 flex-shrink-0" />
              <div className="text-xs text-info dark:text-info/80">
                <p className="font-medium">This account will have full admin privileges:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Manage all users and permissions</li>
                  <li>• Access all system settings</li>
                  <li>• Full control over the application</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSetup}
            disabled={isSettingUp}
            className="w-full"
            size="lg"
          >
            {isSettingUp ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Creating Admin Account...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Create Admin Account
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
