import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, CardHeader, Input, PasswordInput, ToastStack, useToast } from '../components/ui';
import { CheckCircle, Lock, Save, User } from 'lucide-react';

/**
 * Profile page — shared by employer and worker dashboards.
 *
 * Two sections:
 *  1. Personal info (name, email, phone) → PUT /api/auth/profile
 *  2. Change password (current + new)   → PUT /api/auth/change-password
 */
export default function Profile() {
  const { currentUser, updateProfile, changePassword } = useAuth();
  const { toasts, pushToast, dismissToast } = useToast();

  // --- Profile form state ---
  const [name, setName] = useState(currentUser?.name ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<{ name?: string; email?: string }>({});

  // --- Password form state ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // ---- Profile form ----

  const validateProfile = (): boolean => {
    const errs: typeof profileErrors = {};
    if (!name.trim() || name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = 'Please enter a valid email address';
    setProfileErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProfile()) return;
    setProfileSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined });
      pushToast('Profile updated successfully');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update profile. Please try again.';
      pushToast(message, 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  // ---- Password form ----

  const validatePassword = (): boolean => {
    const errs: typeof passwordErrors = {};
    if (!currentPassword) errs.currentPassword = 'Current password is required';
    if (!newPassword) {
      errs.newPassword = 'New password is required';
    } else if (
      newPassword.length < 8 ||
      newPassword.length > 10 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    ) {
      errs.newPassword = 'Password must be 8–10 characters with upper, lower, digit & special character';
    }
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setPasswordErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;
    setPasswordSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      pushToast('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to change password. Please check your current password.';
      pushToast(message, 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ---- Personal information ---- */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#155E63]">
                <User size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              Personal information
            </span>
          }
          subtitle="Update your name, email and phone number"
        />
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={profileErrors.name}
            placeholder="Enter your full name"
          />
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={profileErrors.email}
            placeholder="you@example.com"
          />
          <Input
            label="Phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional — e.g. +91 98765 43210"
            helperText="Optional — visible only to you"
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={profileSaving}>
              <Save size={16} aria-hidden="true" />
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {/* ---- Change password ---- */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#155E63]">
                <Lock size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              Change password
            </span>
          }
          subtitle="Keep your account secure with a strong password"
        />
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <PasswordInput
            label="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            error={passwordErrors.currentPassword}
            placeholder="Enter current password"
            autoComplete="current-password"
          />
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={passwordErrors.newPassword}
            placeholder="8–10 characters, upper, lower, digit & special"
            helperText="Must be 8–10 characters with uppercase, lowercase, digit and special character"
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={passwordErrors.confirmPassword}
            placeholder="Re-enter new password"
            autoComplete="new-password"
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={passwordSaving} variant="secondary">
              <CheckCircle size={16} aria-hidden="true" />
              Change password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
