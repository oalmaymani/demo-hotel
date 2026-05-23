"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
// Navbar is provided by admin layout
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import { adminCreateUser, adminGetUsers, adminUpdateUser, type AdminUser } from "@/lib/api";

type PermissionOption = {
  key: string;
  label: string;
};

function AdminUsersContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale: Locale = sp.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);

  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formPermissions, setFormPermissions] = useState<string[]>([]);

  const [userPerms, setUserPerms] = useState<Record<string, string[]>>({});
  const [userActive, setUserActive] = useState<Record<string, boolean>>({});
  const [userPassword, setUserPassword] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = localStorage.getItem("towseasons_admin_token");
    if (!t) {
      router.push(`/admin/login?lang=${locale}`);
      return;
    }
    const rawPerms = localStorage.getItem("towseasons_admin_perms");
    if (rawPerms) {
      try {
        setPermissions(JSON.parse(rawPerms));
      } catch {
        setPermissions([]);
      }
    } else {
      setPermissions([]);
    }
    setIsSuperAdmin(localStorage.getItem("towseasons_admin_super") === "true");
    setToken(t);
  }, [locale, router]);

  const canManageUsers = isSuperAdmin || permissions.includes("users:manage");

  const permissionOptions: PermissionOption[] = useMemo(() => ([
    { key: "bookings:view", label: m.permissionBookingsView },
    { key: "bookings:status", label: m.permissionBookingsStatus },
    { key: "bookings:unit", label: m.permissionBookingsUnit },
    { key: "requests:manage", label: m.permissionRequestsManage }
  ]), [m]);

  async function loadUsers(t: string) {
    setError(null);
    try {
      const data = await adminGetUsers(t);
      setUsers(data);
      const permsMap: Record<string, string[]> = {};
      const activeMap: Record<string, boolean> = {};
      for (const u of data) {
        permsMap[u.id] = u.permissions || [];
        activeMap[u.id] = u.isActive;
      }
      setUserPerms(permsMap);
      setUserActive(activeMap);
    } catch (e: any) {
      setError(e?.message || "Failed");
    }
  }

  useEffect(() => {
    if (token && canManageUsers) loadUsers(token);
  }, [token, canManageUsers]);

  function logout() {
    localStorage.removeItem("towseasons_admin_token");
    localStorage.removeItem("towseasons_admin_perms");
    localStorage.removeItem("towseasons_admin_super");
    router.push(`/admin/login?lang=${locale}`);
  }

  function togglePermission(list: string[], key: string) {
    if (list.includes(key)) return list.filter((p) => p !== key);
    return [...list, key];
  }

  async function createUser(e: any) {
    e.preventDefault();
    if (!token || !canManageUsers) return;
    if (!formEmail.trim() || !formPassword.trim()) {
      setError(locale === "ar" ? "أكمل البريد وكلمة المرور" : "Enter email and password");
      return;
    }
    if (formPassword.trim().length < 6) {
      setError(locale === "ar" ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await adminCreateUser(token, {
        email: formEmail.trim(),
        password: formPassword,
        permissions: formPermissions,
        isActive: formActive
      });
      setFormEmail("");
      setFormPassword("");
      setFormActive(true);
      setFormPermissions([]);
      await loadUsers(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function saveUser(user: AdminUser) {
    if (!token || !canManageUsers) return;
    if (userPassword[user.id] && userPassword[user.id].trim().length < 6) {
      setError(locale === "ar" ? "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" : "New password must be at least 6 characters");
      return;
    }
    setSavingId(user.id);
    setError(null);
    try {
      await adminUpdateUser(token, user.id, {
        permissions: userPerms[user.id] || [],
        isActive: userActive[user.id],
        password: userPassword[user.id] ? userPassword[user.id] : undefined
      });
      setUserPassword((prev) => ({ ...prev, [user.id]: "" }));
      await loadUsers(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!canManageUsers ? (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border text-amber-800 text-sm">
            {m.noPermission}
          </div>
        ) : null}

        {error ? <div className="mb-3 p-3 rounded-xl bg-red-50 border text-red-700">{error}</div> : null}

        {canManageUsers ? (
          <>
            <div className="rounded-3xl bg-white border shadow-sm p-5 mb-6">
              <h2 className="text-lg font-bold text-primary mb-4">{m.addUser}</h2>
              <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-gray-700">
                  {m.userEmail}
                  <input
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  {m.userPassword}
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                  />
                  {formActive ? m.active : m.inactive}
                </label>
                <div className="md:col-span-2">
                  <div className="text-sm text-gray-700 mb-2">{m.permissions}</div>
                  <div className="flex flex-wrap gap-3">
                    {permissionOptions.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={formPermissions.includes(p.key)}
                          onChange={() => setFormPermissions((prev) => togglePermission(prev, p.key))}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <button
                    disabled={creating}
                    className="px-5 py-3 rounded-2xl bg-primary text-white font-semibold"
                  >
                    {creating ? m.saving : m.addUser}
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-3xl bg-white border shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-primary">{m.users}</h2>
                <div className="text-xs text-gray-500">{m.showing} {users.length}</div>
              </div>
              <div className="space-y-4">
                {users.map((u) => {
                  const isLocked = u.isSuperAdmin;
                  return (
                    <div key={u.id} className="rounded-2xl border p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="font-semibold text-primary">{u.email}</div>
                          {u.isSuperAdmin ? (
                            <div className="text-xs text-emerald-700">{m.superAdmin}</div>
                          ) : null}
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={userActive[u.id] ?? u.isActive}
                            onChange={(e) => setUserActive((prev) => ({ ...prev, [u.id]: e.target.checked }))}
                            disabled={isLocked}
                          />
                          {(userActive[u.id] ?? u.isActive) ? m.active : m.inactive}
                        </label>
                      </div>

                      <div className="mt-3">
                        <div className="text-sm text-gray-700 mb-2">{m.permissions}</div>
                        <div className="flex flex-wrap gap-3">
                          {permissionOptions.map((p) => (
                            <label key={p.key} className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={(userPerms[u.id] || []).includes(p.key)}
                                onChange={() => setUserPerms((prev) => ({ ...prev, [u.id]: togglePermission(prev[u.id] || [], p.key) }))}
                                disabled={isLocked}
                              />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="text-sm text-gray-700">
                          {m.newPassword}
                          <input
                            type="password"
                            value={userPassword[u.id] || ""}
                            onChange={(e) => setUserPassword((prev) => ({ ...prev, [u.id]: e.target.value }))}
                            className="mt-1 w-full px-3 py-2 rounded-xl border"
                            disabled={isLocked}
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            disabled={savingId === u.id || isLocked}
                            onClick={() => saveUser(u)}
                            className="px-5 py-3 rounded-2xl bg-primary text-white font-semibold"
                          >
                            {savingId === u.id ? m.saving : m.save}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {users.length === 0 ? (
                  <div className="text-sm text-gray-500">{locale === "ar" ? "لا يوجد مستخدمون بعد" : "No users yet"}</div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function AdminUsers() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AdminUsersContent />
    </Suspense>
  );
}
