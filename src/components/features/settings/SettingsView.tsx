"use client";

import { Camera, KeyRound, Monitor, Moon, Palette, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Card, Skeleton } from "@/components/ui/misc";
import { SwitchRow } from "@/components/ui/switch";
import type { UserDto } from "@/core/application/dtos";
import { useCurrentUser, useSetCurrentUser } from "@/hooks/useCurrentUser";
import { api, ApiError } from "@/lib/api-client";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { cn } from "@/lib/utils";

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof User;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="grid gap-6 p-6 md:grid-cols-[240px_1fr]">
      <div>
        <div className="flex items-center gap-2 font-semibold">
          <Icon className="text-primary size-4" /> {title}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </Card>
  );
}

const fieldErrors = (e: unknown) =>
  e instanceof ApiError ? Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0]])) : {};

async function save(patch: Record<string, unknown>) {
  return (await api<{ user: UserDto }>("/api/auth/me", { method: "PATCH", body: patch })).user;
}

function ProfileSection({ user }: { user: UserDto }) {
  const setUser = useSetCurrentUser();
  const [name, setName] = useState(user.displayName);
  const [avatar, setAvatar] = useState(user.avatarUrl ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      setUser(await save({ displayName: name, avatarUrl: avatar }));
      setErrors({});
      toast.success("Profile saved");
    } catch (err) {
      setErrors(fieldErrors(err));
      if (!Object.keys(fieldErrors(err)).length) toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Section icon={User} title="Profile" description="How you appear to others in meetings.">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={name || user.displayName} src={avatar || null} size={56} />
          <div className="text-muted-foreground text-sm">{user.email}</div>
        </div>
        <Field label="Display name" htmlFor="displayName" error={errors.displayName}>
          <Input
            id="displayName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            aria-invalid={!!errors.displayName}
          />
        </Field>
        <Field
          label="Avatar URL"
          htmlFor="avatarUrl"
          error={errors.avatarUrl}
          hint="An https:// link to a square image. Leave empty to use your initials."
        >
          <Input
            id="avatarUrl"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://…"
            aria-invalid={!!errors.avatarUrl}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save profile
          </Button>
        </div>
      </form>
    </Section>
  );
}

function AppearanceSection({ user }: { user: UserDto }) {
  const { theme, setTheme } = useTheme();
  const setUser = useSetCurrentUser();
  const options = [
    { id: "dark", label: "Dark", icon: Moon, value: "DARK" },
    { id: "light", label: "Light", icon: Sun, value: "LIGHT" },
    { id: "system", label: "System", icon: Monitor, value: "SYSTEM" },
  ] as const;
  return (
    <Section icon={Palette} title="Appearance" description="Dark looks great on calls; light is easy on bright rooms.">
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={theme === o.id}
            onClick={async () => {
              setTheme(o.id);
              setUser(await save({ theme: o.value }).catch(() => user));
            }}
            className={cn(
              "hover:bg-muted flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition",
              theme === o.id && "border-primary bg-primary-soft/40",
            )}
          >
            <o.icon className="size-5" /> {o.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function DevicesSection({ user }: { user: UserDto }) {
  const setUser = useSetCurrentUser();
  const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);
  const [prefs, setPrefs] = useState({ noiseSuppression: true, echoCancellation: true, ...user.preferences });

  const load = async (askPermission: boolean) => {
    try {
      if (askPermission) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        s.getTracks().forEach((t) => t.stop());
      }
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch {
      toast.error("Allow camera and microphone access to choose devices.");
    }
  };
  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);

  const update = async (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      setUser(await save({ preferences: next }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const labelled = devices?.some((d) => d.label);
  const select = (kind: MediaDeviceKind, key: "cameraId" | "microphoneId" | "speakerId", label: string) => {
    const list = devices?.filter((d) => d.kind === kind && d.deviceId) ?? [];
    return (
      <Field label={label} htmlFor={key}>
        <NativeSelect
          id={key}
          value={prefs[key] ?? ""}
          onChange={(e) => void update({ [key]: e.target.value || undefined })}
        >
          <option value="">System default</option>
          {list.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `${label} ${i + 1}`}
            </option>
          ))}
        </NativeSelect>
      </Field>
    );
  };

  return (
    <Section
      icon={Camera}
      title="Audio & video"
      description="Defaults used when you join a meeting. You can still change them in the lobby."
    >
      {devices === null ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-4">
          {!labelled && (
            <div className="bg-muted flex items-center justify-between gap-3 rounded-xl p-3 text-sm">
              <span>Allow access to see your device names.</span>
              <Button size="sm" variant="outline" onClick={() => void load(true)}>
                Allow access
              </Button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {select("videoinput", "cameraId", "Camera")}
            {select("audioinput", "microphoneId", "Microphone")}
            {select("audiooutput", "speakerId", "Speaker")}
          </div>
          <div className="divide-y rounded-xl border px-4">
            <SwitchRow
              id="pref-ns"
              label="Noise suppression"
              checked={prefs.noiseSuppression ?? true}
              onCheckedChange={(v) => void update({ noiseSuppression: v })}
            />
            <SwitchRow
              id="pref-ec"
              label="Echo cancellation"
              checked={prefs.echoCancellation ?? true}
              onCheckedChange={(v) => void update({ echoCancellation: v })}
            />
          </div>
        </div>
      )}
    </Section>
  );
}

function PasswordSection() {
  const setUser = useSetCurrentUser();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      return setErrors(next);
    }
    setSaving(true);
    try {
      setUser((await api<{ user: UserDto }>("/api/auth/password", { method: "POST", body: parsed.data })).user);
      setErrors({});
      form.reset();
      toast.success("Password changed", { description: "Other devices were signed out." });
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Section icon={KeyRound} title="Password" description="Changing it signs you out everywhere else.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword}>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.currentPassword}
          />
        </Field>
        <Field
          label="New password"
          htmlFor="newPassword"
          error={errors.newPassword}
          hint="At least 10 characters with a letter and a number."
        >
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Change password
          </Button>
        </div>
      </form>
    </Section>
  );
}

export function SettingsView() {
  const { data: user } = useCurrentUser();
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="text-muted-foreground mt-1">Manage your profile, devices and security.</p>
      <div className="mt-8 space-y-6">
        {!user ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)
        ) : (
          <>
            <ProfileSection user={user} />
            <AppearanceSection user={user} />
            <DevicesSection user={user} />
            <PasswordSection />
          </>
        )}
      </div>
    </div>
  );
}
